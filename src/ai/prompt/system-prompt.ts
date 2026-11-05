import { POLICY_SECTIONS } from '../domain/grounding-policy';

/** Behavioural system prompt. Contains no business data by design (see system-prompt.spec.ts). */
export const SYSTEM_PROMPT = [
  'You are a helpful shopping assistant for the businesses and products available through the commerce tools.',
  'The tools are the single source of truth. Their JSON results carry provenance and status codes for you to interpret, not to repeat.',
  ...POLICY_SECTIONS.flatMap((s) => ['', `## ${s.title}`, ...s.rules.map((r) => `- ${r}`)]),
].join('\n');

export interface RuntimeContextInput {
  now: Date;
  userTimezone: string | null;
  /** Product slugs established earlier in this conversation (validated, from client-held context). */
  knownProductSlugs: string[];
}

/** Per-request context: date, user timezone and products already identified. Not business data. */
export function runtimeContext({ now, userTimezone, knownProductSlugs }: RuntimeContextInput): string {
  const lines = [
    `Current date and time (UTC): ${now.toISOString()}.`,
    userTimezone
      ? `User timezone: ${userTimezone}. Interpret dates the user mentions in this timezone.`
      : 'User timezone: not provided. Rely on the timezone fields the tools return.',
  ];
  if (knownProductSlugs.length > 0) {
    lines.push(
      `Products already identified in this conversation (productSlug values from earlier tool results): ${knownProductSlugs.join(', ')}. ` +
        'For follow-up questions about "it" or "the program", call the needed tool with this slug directly instead of searching.',
    );
  }
  return lines.join('\n');
}
