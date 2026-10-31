// src/llm/llm.service.ts
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import type {
  ChatCompletionMessage,
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from 'openai/resources/chat/completions';

const REQUEST_TIMEOUT_MS = 60_000;

@Injectable()
export class LlmService {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(configService: ConfigService) {
    this.client = new OpenAI({
      apiKey: configService.get<string>('OPEN_AI_API_KEY'),
      timeout: REQUEST_TIMEOUT_MS,
    });
    this.model = configService.get<string>('OPEN_AI_MODEL') ?? 'gpt-4o-mini';
  }

  async chat(
    messages: ChatCompletionMessageParam[],
    tools: ChatCompletionTool[],
  ): Promise<ChatCompletionMessage> {
    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages,
      tools,
    });
    return completion.choices[0].message;
  }

  // Asks for a reply that must match the JSON schema, for use inside background jobs
  async structured<T>(
    system: string,
    user: string,
    name: string,
    schema: Record<string, unknown>,
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

    const content = completion.choices[0].message.content;
    if (!content) {
      throw new InternalServerErrorException('The AI returned an empty reply');
    }
    return JSON.parse(content) as T;
  }
}
