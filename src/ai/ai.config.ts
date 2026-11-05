import type { ChatCompletion, ChatCompletionCreateParamsNonStreaming } from 'openai/resources/chat/completions';

/** The only place the default model name lives. Override with OPENAI_MODEL. */
export const DEFAULT_OPENAI_MODEL = 'gpt-5-mini';
export const DEFAULT_MAX_TOOL_ITERATIONS = 6;
/** Hard cap on tool calls in one chat request, across all iterations. */
export const MAX_TOOL_CALLS_PER_REQUEST = 16;

export const OPENAI_CLIENT = Symbol('OPENAI_CLIENT');
export const AI_CONFIG = Symbol('AI_CONFIG');

export interface AiConfig {
  model: string;
  maxToolIterations: number;
}

/** The subset of the OpenAI client we use; lets unit tests inject a mock. */
export interface ChatClient {
  chat: { completions: { create(params: ChatCompletionCreateParamsNonStreaming): Promise<ChatCompletion> } };
}
