import type { ChatAction } from '../domain/actions';
import type { ToolErrorCode } from '../tools/tool.types';

export interface ToolTraceEntry {
  tool: string;
  success: boolean;
  durationMs: number;
  arguments: Record<string, unknown> | null;
  errorCode: ToolErrorCode | null;
}

export interface ChatResponseDto {
  message: string;
  actions: ChatAction[];
  /** Echo `context.productSlugs` back on this turn's history entry to keep follow-ups grounded. */
  context: { productSlugs: string[] };
  toolTrace: ToolTraceEntry[];
  meta: { model: string; iterations: number; stoppedReason: 'COMPLETED' | 'MAX_TOOL_ITERATIONS' };
}
