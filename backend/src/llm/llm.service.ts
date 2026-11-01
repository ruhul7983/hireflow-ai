// src/llm/llm.service.ts
import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AIMessage, BaseMessage } from '@langchain/core/messages';
import type { StructuredToolInterface } from '@langchain/core/tools';
import { ChatOpenAI } from '@langchain/openai';
import { LlmPurpose } from '@prisma/client';
import OpenAI from 'openai';
import { PrismaService } from 'src/prisma/prisma.service';

const REQUEST_TIMEOUT_MS = 60_000;
const TOKENS_PER_PRICE = 1_000_000;
const MODEL_RETRIES = 2;

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
  private readonly chatModel: ChatOpenAI;
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
    this.chatModel = new ChatOpenAI({
      model: this.model,
      apiKey: configService.get<string>('OPEN_AI_API_KEY'),
      timeout: REQUEST_TIMEOUT_MS,
      maxRetries: MODEL_RETRIES,
    });
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
  private async record(
    scope: LlmScope,
    inputTokens: number | undefined,
    outputTokens: number | undefined,
  ) {
    if (inputTokens === undefined || outputTokens === undefined) return;

    try {
      await this.prisma.llmUsage.create({
        data: { ...scope, model: this.model, inputTokens, outputTokens },
      });
    } catch (error) {
      this.logger.warn(`Could not record AI usage: ${(error as Error).message}`);
    }
  }

  // Strict means a tool call always matches its schema, so handlers get valid arguments
  async invokeWithTools(
    messages: BaseMessage[],
    tools: StructuredToolInterface[],
    scope: LlmScope,
  ): Promise<AIMessage> {
    const message = await this.chatModel
      .bindTools(tools, { strict: true })
      .invoke(messages);

    await this.record(
      scope,
      message.usage_metadata?.input_tokens,
      message.usage_metadata?.output_tokens,
    );
    return message;
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
    await this.record(
      scope,
      completion.usage?.prompt_tokens,
      completion.usage?.completion_tokens,
    );

    const content = completion.choices[0].message.content;
    if (!content) {
      throw new InternalServerErrorException('The AI returned an empty reply');
    }
    return JSON.parse(content) as T;
  }
}
