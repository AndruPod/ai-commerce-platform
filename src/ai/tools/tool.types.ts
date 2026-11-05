import type { ChatCompletionFunctionTool } from 'openai/resources/chat/completions';

export interface ToolContext {
  /** IANA timezone supplied with the chat request (already validated), if any. */
  userTimezone: string | null;
}

export type ToolErrorCode = 'UNKNOWN_TOOL' | 'INVALID_ARGUMENTS' | 'NOT_FOUND' | 'DOMAIN_ERROR' | 'TOOL_FAILED' | 'TOO_MANY_TOOL_CALLS';

/** Envelope returned to the model for every tool call. */
export type ToolResult =
  | { ok: true; data: unknown }
  | { ok: false; error: { code: ToolErrorCode; message: string; details?: string[] } };

export interface ToolExecution {
  tool: string;
  success: boolean;
  durationMs: number;
  /** Validated arguments actually passed to the commerce layer (null when rejected). */
  arguments: Record<string, unknown> | null;
  errorCode: ToolErrorCode | null;
  result: ToolResult;
}

/**
 * A commerce capability exposed to the model. `argsClass` is a class-validator
 * DTO: model-produced arguments are validated before `execute` runs.
 */
export interface CommerceTool<A extends object = object> {
  readonly name: string;
  readonly definition: ChatCompletionFunctionTool;
  readonly argsClass: new () => A;
  /** Optional deterministic defaults applied before validation (e.g. the user's timezone). */
  applyDefaults?(raw: Record<string, unknown>, ctx: ToolContext): Record<string, unknown>;
  execute(args: A, ctx: ToolContext): Promise<unknown>;
}

export function functionTool(name: string, description: string, properties: Record<string, unknown>, required: string[]): ChatCompletionFunctionTool {
  return {
    type: 'function',
    function: { name, description, parameters: { type: 'object', properties, required, additionalProperties: false } },
  };
}

export const PRODUCT_SLUG_PROPERTY = {
  type: 'string',
  description: 'Product slug exactly as returned by search_products (items[].slug).',
};
