// src/campaign-setup/campaign-setup.service.ts
import { Command, isInterrupted, INTERRUPT } from '@langchain/langgraph';
import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  CandidateStatus,
  CardType,
  MessageRole,
  QuestionStatus,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { ActionsService } from 'src/chat/actions.service';
import { CandidatesService } from 'src/chat/candidates.service';
import { ChatService } from 'src/chat/chat.service';
import { OutreachService } from 'src/outreach/outreach.service';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  CampaignAnswerReader,
  CANCEL_WORDS,
  MAX_DAILY_LIMIT,
  MAX_STEPS,
  ParsedAnswer,
  parseAnswer,
} from './campaign-setup.answers';
import {
  buildCampaignSetupGraph,
  QuestionKey,
  SetupQuestion,
  SetupValues,
} from './campaign-setup.graph';
import { PrismaCheckpointSaver } from './prisma-checkpoint.saver';

// What the recruiter has plainly stated already, so it isn't asked again
export type KnownAnswers = {
  dayOffsets?: number[] | null;
  dailyLimit?: number | null;
  instructions?: string | null;
};

// Values from chat pass through a model, so a bad one is asked about, not trusted
function validDays(days: number[] | null | undefined) {
  if (!days?.length || days.length > MAX_STEPS) return null;

  const sorted = [...new Set(days)].sort((a, b) => a - b);
  return sorted[0] === 0 && sorted.every(Number.isInteger) ? sorted : null;
}

export function validLimit(limit: number | null | undefined) {
  return limit && limit >= 1 && limit <= MAX_DAILY_LIMIT ? limit : null;
}

@Injectable()
export class CampaignSetupService {
  private readonly logger = new Logger(CampaignSetupService.name);
  private readonly graph: ReturnType<typeof buildCampaignSetupGraph>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly chat: ChatService,
    private readonly actions: ActionsService,
    private readonly candidates: CandidatesService,
    private readonly outreach: OutreachService,
    private readonly answers: CampaignAnswerReader,
    private readonly checkpoints: PrismaCheckpointSaver,
  ) {
    this.graph = buildCampaignSetupGraph(checkpoints);
  }

  private say(conversationId: string, content: string) {
    return this.chat.appendMessage(conversationId, {
      role: MessageRole.ASSISTANT,
      content,
    });
  }

  private config(threadId: string) {
    return { configurable: { thread_id: threadId } };
  }

  pendingQuestion(conversationId: string) {
    return this.prisma.agentQuestion.findFirst({
      where: { conversationId, status: QuestionStatus.PENDING },
      orderBy: { createdAt: 'desc' },
      include: { options: { orderBy: { position: 'asc' } } },
    });
  }

  async start(conversationId: string, userId: string, known: KnownAnswers = {}) {
    const conversation = await this.chat.assertOwned(conversationId, userId);

    if (!conversation.jobId) {
      await this.say(conversationId, 'There is no job in this chat yet.');
      return;
    }

    const stale = await this.pendingQuestion(conversationId);
    if (stale) await this.closeQuestion(stale.id, stale.threadId);
    await this.actions.cancelOpenCampaignPlans(conversationId);

    const [eligible, holding, withoutEmail] = await Promise.all([
      this.outreach.eligibleCandidates(conversation.jobId),
      this.outreach.campaignsHoldingCandidates(conversation.jobId),
      this.prisma.candidate.count({
        where: {
          jobId: conversation.jobId,
          status: CandidateStatus.ACCEPTED,
          email: null,
        },
      }),
    ]);

    if (eligible.length === 0) {
      const live = holding
        .map(({ name, status }) => `${name} (${status.toLowerCase()})`)
        .join(', ');

      await this.say(
        conversationId,
        live
          ? `Your accepted candidates are already in ${live}. Ask me to resume it, or to stop it so you can set up a new one.`
          : withoutEmail > 0
            ? `${withoutEmail} accepted candidates have no email address, so they can't be contacted. Search results don't include emails, so please upload a CSV that has them.`
            : "There is nobody to contact yet. Accept some candidates first. Anyone who has already been emailed isn't emailed again.",
      );
      return;
    }

    const threadId = randomUUID();
    const input: SetupValues = {
      candidates: eligible.map(({ id, score }) => ({ id, score })),
      candidateIds: null,
      isSequence: null,
      dayOffsets: validDays(known.dayOffsets),
      dailyLimit: validLimit(known.dailyLimit),
      instructions: known.instructions,
    };

    const result = await this.graph.invoke(input, this.config(threadId));
    await this.afterRun(conversationId, threadId, result, withoutEmail);
  }

  // Either the graph paused on the next question, or every answer is in
  private async afterRun(
    conversationId: string,
    threadId: string,
    result: Awaited<ReturnType<typeof this.graph.invoke>>,
    withoutEmail: number,
  ) {
    if (isInterrupted(result)) {
      const [{ value }] = result[INTERRUPT];
      await this.askQuestion(conversationId, threadId, value as SetupQuestion);
      return;
    }

    await this.proposePlan(conversationId, threadId, result, withoutEmail);
  }

  private async askQuestion(
    conversationId: string,
    threadId: string,
    { key, prompt, hint, options }: SetupQuestion,
  ) {
    const question = await this.prisma.agentQuestion.create({
      data: {
        conversationId,
        threadId,
        key,
        options: {
          create: options.map((option, position) => ({ ...option, position })),
        },
      },
    });

    await this.chat.appendMessage(conversationId, {
      role: MessageRole.ASSISTANT,
      content: hint ? `${prompt} ${hint}` : prompt,
      cardType: CardType.QUESTION,
      questionId: question.id,
    });
  }

  private async proposePlan(
    conversationId: string,
    threadId: string,
    values: SetupValues,
    withoutEmail: number,
  ) {
    await this.checkpoints.deleteThread(threadId);

    const conversation = await this.prisma.conversation.findUniqueOrThrow({
      where: { id: conversationId },
      include: { job: true },
    });
    const jobId = conversation.jobId;
    if (!jobId || !conversation.job) throw new Error('The job no longer exists');

    const card = await this.actions.proposeCampaign(conversationId, jobId, {
      name: `${conversation.job.title} outreach`,
      dayOffsets: values.dayOffsets ?? [0],
      dailyLimit: values.dailyLimit ?? 1,
      instructions: values.instructions ?? null,
      candidateIds: values.candidateIds ?? [],
    });

    const note =
      withoutEmail > 0
        ? ` ${withoutEmail} accepted candidates have no email, so they are left out.`
        : '';

    await this.chat.appendMessage(conversationId, {
      role: MessageRole.ASSISTANT,
      ...card,
      content: `${card.content}${note}`,
    });
  }

  private async closeQuestion(
    questionId: string,
    threadId: string,
    answerLabel?: string,
  ) {
    const { count } = await this.prisma.agentQuestion.updateMany({
      where: { id: questionId, status: QuestionStatus.PENDING },
      data: {
        status: answerLabel ? QuestionStatus.ANSWERED : QuestionStatus.CANCELLED,
        answerLabel,
        resolvedAt: new Date(),
      },
    });

    if (!answerLabel) await this.checkpoints.deleteThread(threadId);
    return count === 1;
  }

  // Resumes the paused graph with the recruiter's answer
  private async resume(
    question: { id: string; conversationId: string; threadId: string },
    value: string,
    label: string,
  ) {
    // Claiming the row first means a double click can't resume the run twice
    const claimed = await this.closeQuestion(question.id, question.threadId, label);
    if (!claimed) {
      throw new ConflictException('This question has already been answered');
    }

    const result = await this.graph.invoke(
      new Command({ resume: value }),
      this.config(question.threadId),
    );

    const conversation = await this.prisma.conversation.findUniqueOrThrow({
      where: { id: question.conversationId },
    });
    const withoutEmail = await this.prisma.candidate.count({
      where: {
        jobId: conversation.jobId ?? '',
        status: CandidateStatus.ACCEPTED,
        email: null,
      },
    });

    await this.afterRun(
      question.conversationId,
      question.threadId,
      result,
      withoutEmail,
    );
  }

  private async findOwned(questionId: string, userId: string) {
    const question = await this.prisma.agentQuestion.findFirst({
      where: { id: questionId, conversation: { userId } },
      include: { options: true },
    });

    if (!question) {
      throw new NotFoundException('Question not found');
    }
    return question;
  }

  async answerWithOption(questionId: string, optionId: string, userId: string) {
    const question = await this.findOwned(questionId, userId);
    const option = question.options.find(({ id }) => id === optionId);

    if (!option) {
      throw new NotFoundException('That option is not part of this question');
    }

    await this.chat.appendMessage(question.conversationId, {
      role: MessageRole.USER,
      content: option.label,
    });
    await this.resume(question, option.value, option.label);
  }

  async cancel(questionId: string, userId: string) {
    const question = await this.findOwned(questionId, userId);
    const closed = await this.closeQuestion(question.id, question.threadId);

    if (!closed) {
      throw new ConflictException('This question has already been answered');
    }
    await this.say(
      question.conversationId,
      'Okay, I stopped the campaign setup. Nothing was created.',
    );
  }

  private async read(
    question: NonNullable<Awaited<ReturnType<CampaignSetupService['pendingQuestion']>>>,
    text: string,
    candidateCount: number,
  ): Promise<ParsedAnswer> {
    const key = question.key as QuestionKey;
    const direct =
      key === 'tone'
        ? null
        : parseAnswer(key, text, question.options, candidateCount);

    if (direct?.ok || direct?.problem) return direct;

    // Only here does the model help, and it can't invent an answer of its own
    const prompt = await this.prisma.message.findFirst({
      where: { questionId: question.id },
      select: { content: true },
    });
    const reading = await this.answers.read(prompt?.content ?? '', text);

    if (reading.intent !== 'answer' || !reading.answer) {
      return { ok: false, problem: null };
    }
    return parseAnswer(key, reading.answer, question.options, candidateCount);
  }

  // Returns false when the message isn't an answer, so the normal agent can take it
  async handleTypedMessage(conversationId: string, text: string) {
    const question = await this.pendingQuestion(conversationId);
    if (!question) return false;

    if (CANCEL_WORDS.test(text.trim())) {
      await this.closeQuestion(question.id, question.threadId);
      await this.say(
        conversationId,
        'Okay, I stopped the campaign setup. Nothing was created.',
      );
      return true;
    }

    const conversation = await this.prisma.conversation.findUniqueOrThrow({
      where: { id: conversationId },
    });
    const eligible = await this.outreach.eligibleCandidates(
      conversation.jobId ?? '',
    );

    try {
      const answer = await this.read(question, text, eligible.length);

      if (answer.ok) {
        await this.resume(question, answer.value, answer.label);
        return true;
      }
      if (answer.problem) {
        await this.say(conversationId, answer.problem);
        return true;
      }
    } catch (error) {
      this.logger.error(`Could not read an answer: ${(error as Error).message}`);
      await this.say(
        conversationId,
        "I couldn't read that. Please pick one of the buttons above.",
      );
      return true;
    }

    return false;
  }
}
