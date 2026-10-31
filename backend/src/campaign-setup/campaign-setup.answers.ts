// src/campaign-setup/campaign-setup.answers.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { initChatModel } from 'langchain';
import type { QuestionKey } from './campaign-setup.graph';

export const MAX_STEPS = 5;
export const MAX_DAILY_LIMIT = 500;
const MAX_TONE_LENGTH = 200;

export const CANCEL_WORDS =
  /^(cancel|stop|never ?mind|forget it|no thanks)\b[\s\w,.!]{0,24}$/i;

export type ParsedAnswer =
  | { ok: true; value: string; label: string }
  | { ok: false; problem: string | null };

const UNREADABLE: ParsedAnswer = { ok: false, problem: null };

type AnswerOption = { label: string; value: string };

export function parseTiming(text: string): ParsedAnswer {
  const numbers = text.match(/\d+/g)?.map(Number);
  if (!numbers) return UNREADABLE;

  // "3 and 7" means follow-ups, so the first email still goes out on day 0
  const days = [...new Set([0, ...numbers])].sort((a, b) => a - b);

  if (days.length < 2) {
    return {
      ok: false,
      problem:
        'A sequence needs at least one follow-up after day 0. Pick an option, or type days like "0, 3, 7".',
    };
  }
  if (days.length > MAX_STEPS) {
    return {
      ok: false,
      problem: `A sequence can have up to ${MAX_STEPS} emails. Please pick fewer days.`,
    };
  }

  return {
    ok: true,
    value: days.join(','),
    label: `Day ${days.join(', ')}`,
  };
}

function parseLimit(text: string): ParsedAnswer {
  const number = text.match(/\d+/)?.[0];
  if (!number) return UNREADABLE;

  const limit = Number(number);
  if (limit < 1 || limit > MAX_DAILY_LIMIT) {
    return {
      ok: false,
      problem: `Please choose a limit between 1 and ${MAX_DAILY_LIMIT} emails a day.`,
    };
  }
  return { ok: true, value: String(limit), label: `${limit} a day` };
}

function parseRecipients(text: string, total: number): ParsedAnswer {
  if (/\b(all|everyone|every)\b/i.test(text)) {
    return { ok: true, value: 'all', label: `All ${total} candidates` };
  }

  const top = text.match(/\b(?:top|best|first)\s+(\d+)\b/i)?.[1];
  if (!top) return UNREADABLE;

  const count = Number(top);
  if (count < 1 || count > total) {
    return {
      ok: false,
      problem: `Please choose between 1 and ${total} candidates.`,
    };
  }
  return { ok: true, value: `top:${count}`, label: `Top ${count} by score` };
}

function parseFormat(text: string): ParsedAnswer {
  if (/\b(sequence|follow.?ups?|multi|steps?)\b/i.test(text)) {
    return { ok: true, value: 'sequence', label: 'Sequence with follow-ups' };
  }
  if (/\b(single|one|just one)\b/i.test(text)) {
    return { ok: true, value: 'single', label: 'Single email' };
  }
  return UNREADABLE;
}

// Plain code reads every answer it can, so the model is only asked about the rest
export function parseAnswer(
  key: QuestionKey,
  text: string,
  options: AnswerOption[],
  candidateCount: number,
): ParsedAnswer {
  const typed = text.trim();
  const option = options.find(
    ({ label, value }) =>
      label.toLowerCase() === typed.toLowerCase() || value === typed,
  );
  if (option) return { ok: true, value: option.value, label: option.label };

  switch (key) {
    case 'timing':
      return parseTiming(typed);
    case 'limit':
      return parseLimit(typed);
    case 'recipients':
      return parseRecipients(typed, candidateCount);
    case 'format':
      return parseFormat(typed);
    case 'tone':
      return typed.length <= MAX_TONE_LENGTH
        ? { ok: true, value: typed, label: typed }
        : { ok: false, problem: 'Please keep this under 200 characters.' };
  }
}

const SYSTEM_PROMPT = `A recruiter was asked a question while setting up an email campaign. Decide what their reply means.

- "answer": the reply answers the question. Put the answer in "answer" in a short, plain form.
- "other": the reply is about something else, such as asking how a job is going, or it doesn't answer the question.

Never guess an answer the recruiter didn't give. "yes" or "ok" alone is "other" unless the question can be answered that way.`;

const REPLY_SCHEMA = {
  title: 'recruiter_reply',
  type: 'object',
  additionalProperties: false,
  required: ['intent', 'answer'],
  properties: {
    intent: { type: 'string', enum: ['answer', 'other'] },
    answer: { type: ['string', 'null'] },
  },
};

type ReplyReading = { intent: 'answer' | 'other'; answer: string | null };

@Injectable()
export class CampaignAnswerReader {
  constructor(private readonly configService: ConfigService) {}

  // Tells an answer apart from an unrelated message, and normalises free wording
  async read(question: string, reply: string) {
    const model = await initChatModel(
      this.configService.get<string>('OPEN_AI_MODEL') ?? 'gpt-4o-mini',
      {
        modelProvider: 'openai',
        apiKey: this.configService.get<string>('OPEN_AI_API_KEY'),
      },
    );

    const reading = (await model
      .withStructuredOutput(REPLY_SCHEMA, { method: 'jsonSchema', strict: true })
      .invoke([
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Question: ${question}\nReply: ${reply}` },
      ])) as ReplyReading;

    return reading;
  }
}
