// src/llm/llm.service.ts
import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LlmPurpose } from '@prisma/client';
import OpenAI from 'openai';
import type {
  ChatCompletionMessage,
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from 'openai/resources/chat/completions';
import type { CompletionUsage } from 'openai/resources/completions';
import { PrismaService } from 'src/prisma/prisma.service';

const REQUEST_TIMEOUT_MS = 60_000;
const TOKENS_PER_PRICE = 1_000_000;

// The published gpt-4o-mini prices, in USD. Set both when using another model.
const DEFAULT_INPUT_PRICE = 0.15;
const DEFAULT_OUTPUT_PRICE = 0.6;

export type LlmScope = {
  purpose: LlmPurpose;
  jobId?: string | null;
  conversationId?: string | null;
};

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly client: OpenAI;
  private readonly model: string;
  private readonly inputPrice: number;
  private readonly outputPrice: number;

  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.client = new OpenAI({
      apiKey: configService.get<string>('OPEN_AI_API_KEY'),
      timeout: REQUEST_TIMEOUT_MS,
    });
    this.model = configService.get<string>('OPEN_AI_MODEL') ?? 'gpt-4o-mini';
    this.inputPrice = Number(
      configService.get('LLM_INPUT_USD_PER_MILLION') ?? DEFAULT_INPUT_PRICE,
    );
    this.outputPrice = Number(
      configService.get('LLM_OUTPUT_USD_PER_MILLION') ?? DEFAULT_OUTPUT_PRICE,
    );
  }

  costOf(inputTokens: number, outputTokens: number) {
    return (
      (inputTokens * this.inputPrice + outputTokens * this.outputPrice) /
      TOKENS_PER_PRICE
    );
  }

  // Tracking must never cost the recruiter a finished AI result
  private async record(scope: LlmScope, usage: CompletionUsage | undefined) {
    if (!usage) return;

    try {
      await this.prisma.llmUsage.create({
        data: {
          ...scope,
          model: this.model,
          inputTokens: usage.prompt_tokens,
          outputTokens: usage.completion_tokens,
        },
      });
    } catch (error) {
      this.logger.warn(`Could not record AI usage: ${(error as Error).message}`);
    }
  }

  async chat(
    messages: ChatCompletionMessageParam[],
    tools: ChatCompletionTool[],
    scope: LlmScope,
  ): Promise<ChatCompletionMessage> {
    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages,
      tools,
    });
    await this.record(scope, completion.usage);
    return completion.choices[0].message;
  }

  // Asks for a reply that must match the JSON schema, for use inside background jobs
  async structured<T>(
    system: string,
    user: string,
    name: string,
    schema: Record<string, unknown>,
    scope: LlmScope,
  ): Promise<T> {
    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name, schema, strict: true },
      },
    });
    await this.record(scope, completion.usage);

    const content = completion.choices[0].message.content;
    if (!content) {
      throw new InternalServerErrorException('The AI returned an empty reply');
    }
    return JSON.parse(content) as T;
  }
}
