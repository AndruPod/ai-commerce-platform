import { toLookupKey } from '../../common/lookup-key';
import type { ToolTraceEntry } from '../dto/chat.response';

/**
 * Evaluation-only heuristic: flags search filters that have no visible basis in
 * the conversation text (e.g. deliveryMode IN_PERSON when nobody mentioned it).
 * It is deliberately simple and English-only; it reports, it never blocks.
 * Arguments that normally come from tool results (productSlug) or that the
 * model normalises from free-form dates are not audited.
 */
export interface ArgumentFinding {
  tool: string;
  argument: string;
  value: unknown;
  reason: string;
}

const CUES: Record<string, Record<string, RegExp>> = {
  deliveryMode: {
    ONLINE_LIVE: /\b(online|from home|at home|remote(ly)?|virtual(ly)?|zoom|live[- ]?stream(ed)?|anywhere)\b/,
    IN_PERSON: /\b(in[- ]person|studio|on[- ]site|face[- ]to[- ]face|near me|local(ly)?|venue)\b/,
    HYBRID: /\bhybrid\b/,
  },
  level: {
    BEGINNER: /\b(beginners?|new to|never|first[- ]time|no experience|novice)\b/,
    RECREATIONAL: /\b(recreational(ly)?|hobby|casual(ly)?|for fun)\b/,
    ADVANCED: /\b(advanced|experienced|intermediate)\b/,
    PROFESSIONAL: /\b(professionals?|pro)\b/,
  },
};

function durationCue(months: number): RegExp {
  return months === 12
    ? /\b(year[- ]?long|a year|one year|1[- ]year|annual(ly)?|12[- ]?months?|twelve months|yearly)\b/
    : new RegExp(`\\b(${months}[- ]?months?)\\b`);
}

export function auditToolArguments(conversationText: string, trace: ToolTraceEntry[]): ArgumentFinding[] {
  const text = conversationText.toLowerCase();
  const textKey = toLookupKey(conversationText);
  const findings: ArgumentFinding[] = [];
  const flag = (tool: string, argument: string, value: unknown, reason: string) => findings.push({ tool, argument, value, reason });

  for (const t of trace) {
    if (t.tool !== 'search_products' || !t.arguments) continue;
    for (const [arg, value] of Object.entries(t.arguments)) {
      if (arg === 'deliveryMode' || arg === 'level') {
        const cue = CUES[arg][String(value)];
        if (cue && !cue.test(text)) flag(t.tool, arg, value, `no "${String(value)}" cue in the conversation`);
      } else if (arg === 'durationMonths') {
        if (!durationCue(Number(value)).test(text)) flag(t.tool, arg, value, 'no matching duration in the conversation');
      } else if (arg === 'discipline') {
        if (!text.includes(String(value).toLowerCase())) flag(t.tool, arg, value, 'discipline not mentioned in the conversation');
      } else if (arg === 'business') {
        if (!textKey.includes(toLookupKey(String(value)))) flag(t.tool, arg, value, 'business name not mentioned in the conversation');
      } else if (arg === 'q') {
        const missing = toLookupKey(String(value)).split(' ').filter((w) => w && !textKey.includes(w));
        if (missing.length > 0) flag(t.tool, arg, value, `query words not in the conversation: ${missing.join(', ')}`);
      }
    }
  }
  return findings;
}
