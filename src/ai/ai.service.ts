import { BadGatewayException, Inject, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import type { ChatCompletion, ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { CLOCK, Clock } from '../common/clock';
import { AI_CONFIG, AiConfig, ChatClient, MAX_TOOL_CALLS_PER_REQUEST, OPENAI_CLIENT } from './ai.config';
import { buildActions } from './domain/actions';
import { redactUngroundedUrls } from './domain/grounding-policy';
import { findInternalTerms } from './domain/presentation-audit';
import type { SearchResolution } from './domain/search-resolution';
import { ChatRequestDto, MAX_CONTEXT_PRODUCTS } from './dto/chat.dto';
import { ChatResponseDto } from './dto/chat.response';
import { runtimeContext, SYSTEM_PROMPT } from './prompt/system-prompt';
import { ToolExecutor } from './tools/tool-executor';
import { ToolContext, ToolExecution } from './tools/tool.types';

export const MAX_ITERATIONS_FALLBACK =
  'Sorry, I could not complete that request reliably. Please try rephrasing or asking about one thing at a time.';

/**
 * Conversation layer. The model reasons and phrases; every fact comes from
 * commerce tools executed in-process. Actions are derived from tool results.
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    @Inject(OPENAI_CLIENT) private readonly client: ChatClient | null,
    @Inject(AI_CONFIG) private readonly config: AiConfig,
    private readonly executor: ToolExecutor,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async chat(req: ChatRequestDto): Promise<ChatResponseDto> {
    if (!this.client) throw new ServiceUnavailableException('The AI layer is not configured (OPENAI_API_KEY is not set).');

    const ctx: ToolContext = { userTimezone: req.timezone ?? null };
    const knownProductSlugs = recentUnique((req.history ?? []).flatMap((h) => h.productSlugs ?? []));
    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'system', content: runtimeContext({ now: this.clock.now(), userTimezone: ctx.userTimezone, knownProductSlugs }) },
      ...(req.history ?? []).map((h): ChatCompletionMessageParam => ({ role: h.role, content: h.content })),
      { role: 'user', content: req.message },
    ];
    const executions: ToolExecution[] = [];

    for (let iteration = 1; iteration <= this.config.maxToolIterations; iteration++) {
      const message = (await this.complete(messages)).choices[0]?.message;
      if (!message) throw new BadGatewayException('The AI provider returned no message.');

      const calls = message.tool_calls ?? [];
      if (calls.length === 0) return this.finish(message.content ?? '', executions, knownProductSlugs, iteration, 'COMPLETED');

      messages.push({ role: 'assistant', content: message.content ?? null, tool_calls: calls });
      for (const call of calls) {
        const execution =
          executions.length >= MAX_TOOL_CALLS_PER_REQUEST
            ? rejected(call.type === 'function' ? call.function.name : call.type, 'TOO_MANY_TOOL_CALLS', 'Tool call limit reached for this request.')
            : call.type === 'function'
              ? await this.executor.execute(call.function.name, call.function.arguments, ctx)
              : rejected(call.type, 'UNKNOWN_TOOL', 'Only function tools are supported.');
        executions.push(execution);
        messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(execution.result) });
      }
    }

    this.logger.warn(`Stopped after ${this.config.maxToolIterations} tool iterations`);
    return this.finish(MAX_ITERATIONS_FALLBACK, executions, knownProductSlugs, this.config.maxToolIterations, 'MAX_TOOL_ITERATIONS');
  }

  private async complete(messages: ChatCompletionMessageParam[]): Promise<ChatCompletion> {
    const started = performance.now();
    try {
      const completion = await this.client!.chat.completions.create({
        model: this.config.model,
        messages,
        tools: this.executor.definitions(),
        tool_choice: 'auto',
      });
      this.logger.log(`openai model=${this.config.model} ${Math.round(performance.now() - started)}ms`);
      return completion;
    } catch (err) {
      // Log status/type only; never request headers (which carry the API key).
      const status = (err as { status?: number }).status;
      this.logger.error(`openai request failed${status ? ` status=${status}` : ''}: ${(err as Error).name}`);
      throw new BadGatewayException('The AI provider request failed.');
    }
  }

  private finish(
    text: string,
    executions: ToolExecution[],
    knownProductSlugs: string[],
    iterations: number,
    stoppedReason: ChatResponseDto['meta']['stoppedReason'],
  ): ChatResponseDto {
    const actions = buildActions(executions);
    const checkoutUrls = actions.flatMap((a) => (a.type === 'CHECKOUT' ? [a.url] : []));
    const message = redactUngroundedUrls(text, checkoutUrls);
    const leaked = findInternalTerms(message);
    if (leaked.length > 0) this.logger.warn(`response contains internal terms: ${leaked.join(', ')}`);
    return {
      message,
      actions,
      context: { productSlugs: recentUnique([...knownProductSlugs, ...productSlugsFrom(executions)]) },
      toolTrace: executions.map(({ tool, success, durationMs, arguments: args, errorCode }) => ({
        tool,
        success,
        durationMs,
        arguments: args,
        errorCode,
      })),
      meta: { model: this.config.model, iterations, stoppedReason },
    };
  }
}

/** Product slugs grounded by successful tool calls in this turn (in call order). */
function productSlugsFrom(executions: ToolExecution[]): string[] {
  return executions.flatMap((e) => {
    if (!e.result.ok) return [];
    if (e.tool === 'search_products') {
      const resolution = (e.result.data as { resolution?: SearchResolution }).resolution;
      return resolution?.singleMatch ? [resolution.singleMatch.productSlug] : [];
    }
    const slug = e.arguments?.productSlug;
    return typeof slug === 'string' ? [slug] : [];
  });
}

/** De-duplicates keeping the most recent occurrence last; caps the list length. */
function recentUnique(slugs: string[]): string[] {
  const out: string[] = [];
  for (const s of slugs) {
    const i = out.indexOf(s);
    if (i > -1) out.splice(i, 1);
    out.push(s);
  }
  return out.slice(-MAX_CONTEXT_PRODUCTS);
}

function rejected(tool: string, code: 'TOO_MANY_TOOL_CALLS' | 'UNKNOWN_TOOL', message: string): ToolExecution {
  return { tool, success: false, durationMs: 0, arguments: null, errorCode: code, result: { ok: false, error: { code, message } } };
}
