import { BadRequestException, HttpException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync, ValidationError } from 'class-validator';
import type { ChatCompletionFunctionTool } from 'openai/resources/chat/completions';
import { ScheduleEvaluationError } from '../../schedule/domain/evaluate-date';
import { CheckDateTool } from './check-date.tool';
import { GetCheckoutTool } from './get-checkout.tool';
import { GetEnrollmentTool } from './get-enrollment.tool';
import { GetProductTool } from './get-product.tool';
import { SearchProductsTool } from './search-products.tool';
import { CommerceTool, ToolContext, ToolErrorCode, ToolExecution, ToolResult } from './tool.types';

/**
 * Validates model-produced arguments and dispatches to the commerce tools.
 * It never throws: every outcome, including domain errors, becomes a
 * structured ToolResult the model can read.
 */
@Injectable()
export class ToolExecutor {
  private readonly logger = new Logger(ToolExecutor.name);
  private readonly tools: Map<string, CommerceTool>;

  constructor(search: SearchProductsTool, product: GetProductTool, date: CheckDateTool, enrollment: GetEnrollmentTool, checkout: GetCheckoutTool) {
    const all: CommerceTool[] = [search, product, date, enrollment, checkout];
    this.tools = new Map(all.map((t) => [t.name, t]));
  }

  definitions(): ChatCompletionFunctionTool[] {
    return [...this.tools.values()].map((t) => t.definition);
  }

  async execute(name: string, rawArguments: string, ctx: ToolContext): Promise<ToolExecution> {
    const started = performance.now();
    const done = (result: ToolResult, args: Record<string, unknown> | null): ToolExecution => {
      const durationMs = Math.round(performance.now() - started);
      const errorCode = result.ok ? null : result.error.code;
      this.logger.log(`tool=${name} ok=${result.ok}${errorCode ? ` error=${errorCode}` : ''} ${durationMs}ms`);
      return { tool: name, success: result.ok, durationMs, arguments: args, errorCode, result };
    };

    const tool = this.tools.get(name);
    if (!tool) return done(failure('UNKNOWN_TOOL', `Unknown tool "${name}".`), null);

    const parsed = parseArguments(rawArguments);
    if (!parsed) return done(failure('INVALID_ARGUMENTS', 'Tool arguments must be a JSON object.'), null);

    const prepared = tool.applyDefaults ? tool.applyDefaults(parsed, ctx) : parsed;
    const instance = plainToInstance(tool.argsClass, prepared);
    const errors = validateSync(instance, { whitelist: true, forbidNonWhitelisted: true });
    if (errors.length > 0) {
      return done(failure('INVALID_ARGUMENTS', 'Tool arguments failed validation.', flatten(errors)), null);
    }
    const validArgs = Object.fromEntries(Object.entries(instance).filter(([, v]) => v !== undefined));

    try {
      return done({ ok: true, data: await tool.execute(instance, ctx) }, validArgs);
    } catch (err) {
      return done(toToolError(err, this.logger, name), validArgs);
    }
  }
}

function failure(code: ToolErrorCode, message: string, details?: string[]): ToolResult {
  return { ok: false, error: { code, message, ...(details ? { details } : {}) } };
}

/** Parses the JSON argument string; `null` values are treated as omitted. */
function parseArguments(raw: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(raw || '{}');
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
    return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== null));
  } catch {
    return null;
  }
}

function flatten(errors: ValidationError[]): string[] {
  return errors.flatMap((e) =>
    e.constraints ? Object.values(e.constraints) : [`${e.property} is invalid`],
  );
}

export function toToolError(err: unknown, logger: Logger, tool: string): ToolResult {
  if (err instanceof NotFoundException) return failure('NOT_FOUND', err.message);
  if (err instanceof BadRequestException || err instanceof ScheduleEvaluationError) return failure('INVALID_ARGUMENTS', err.message);
  if (err instanceof HttpException) return failure('DOMAIN_ERROR', err.message);
  // Unexpected failures: log the detail server-side, return a generic message to the model.
  logger.error(`tool=${tool} unexpected error: ${err instanceof Error ? err.message : String(err)}`);
  return failure('TOOL_FAILED', 'The tool failed unexpectedly. The information is currently unavailable.');
}
