/**
 * Optional live evaluation of the AI layer against the real OpenAI API.
 * NOT part of CI or `pnpm test`.
 *
 *   pnpm eval:ai                                         # print results
 *   pnpm eval:ai -- --out docs/after/run-YYYY-MM-DD.md   # also write a markdown report
 *
 * Requires OPENAI_API_KEY plus a migrated and seeded database.
 */
import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { AiService } from '../src/ai/ai.service';
import { findInternalTerms } from '../src/ai/domain/presentation-audit';
import type { ChatHistoryMessageDto } from '../src/ai/dto/chat.dto';
import type { ChatResponseDto } from '../src/ai/dto/chat.response';
import { ArgumentFinding, auditToolArguments } from '../src/ai/evaluation/argument-audit';
import { CHECKOUT_URL } from '../src/database/seed/vsa-annual-ballet.data';

/** Transaction-safety check: the captured but blocked checkout URL must never reach the user. */
const leaksBlockedUrl = (res: ChatResponseDto) => {
  const json = JSON.stringify({ message: res.message, actions: res.actions });
  return json.includes(CHECKOUT_URL) || json.includes('buy.stripe.com');
};

// Section 1: independent queries, each a fresh conversation.
// The six B-queries must stay verbatim copies of docs/baseline/queries.md.
const INDEPENDENT: { id: string; text: string }[] = [
  { id: 'B1', text: 'Does Victory Skating offer a year-long online ballet program?' },
  { id: 'B2', text: 'Does VSA have online ballet classes for complete beginners?' },
  { id: 'B3', text: "I'm looking for an annual online ballet program that I can join from home. Does Victory Skating have anything?" },
  { id: 'B4', text: "I'm an experienced dancer. Does VSA offer an online ballet program that is also open to advanced students and professionals?" },
  { id: 'B5', text: 'How much is the Victory Skating / VSA 1-Year Online Ballet Club, and what is included?' },
  { id: 'B6', text: 'I want to start taking ballet classes regularly. Can I join the VSA annual program?' },
  { id: 'X1', text: "I'm free on November 6, 2026. Can I join the annual ballet program around that time?" },
  { id: 'X2', text: 'Do I need ballet shoes and a mat?' },
  { id: 'X3', text: 'Is the program $3 per class?' },
  { id: 'X4', text: 'How do I enroll and pay for the VSA annual ballet program?' },
  { id: 'X5', text: 'Is the checkout price the same as the advertised annual program price?' },
];

// Section 2: one conversation; history (incl. context.productSlugs) is passed between turns.
const CONVERSATION: { id: string; text: string }[] = [
  { id: 'C1', text: "I'm interested in the VSA 1-Year Online Ballet Club." },
  { id: 'C2', text: 'How much is it?' },
  { id: 'C3', text: 'Do I need ballet shoes and a mat?' },
  { id: 'C4', text: 'Can I join around November 6, 2026?' },
  { id: 'C5', text: 'How do I enroll?' },
];

const TIMEZONE = process.env.EVAL_TIMEZONE || 'Europe/London';

interface Result {
  section: 'independent' | 'conversation';
  id: string;
  query: string;
  res?: ChatResponseDto;
  error?: string;
  leaks: string[];
  argumentFindings: ArgumentFinding[];
}

async function main(): Promise<void> {
  if (!process.env.OPENAI_API_KEY) {
    console.log('SKIPPED: OPENAI_API_KEY is not set. Live AI evaluation was not run.');
    return;
  }
  const outIdx = process.argv.indexOf('--out');
  const outPath = outIdx > -1 ? process.argv[outIdx + 1] : null;

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const ai = app.get(AiService);
  const results: Result[] = [];

  const run = async (section: Result['section'], id: string, text: string, history: ChatHistoryMessageDto[]): Promise<Result> => {
    const conversationText = [...history.map((h) => h.content), text].join('\n');
    try {
      const res = await ai.chat({ message: text, timezone: TIMEZONE, history });
      const r: Result = { section, id, query: text, res, leaks: findInternalTerms(res.message), argumentFindings: auditToolArguments(conversationText, res.toolTrace) };
      print(r);
      return r;
    } catch (err) {
      const r: Result = { section, id, query: text, error: (err as Error).message, leaks: [], argumentFindings: [] };
      console.log(`\n### ${id}: ${text}\nERROR: ${r.error}`);
      return r;
    }
  };

  try {
    console.log('\n######## SECTION 1: INDEPENDENT QUERIES ########');
    for (const q of INDEPENDENT) results.push(await run('independent', q.id, q.text, []));

    console.log('\n######## SECTION 2: CONVERSATIONAL EVALUATION ########');
    const history: ChatHistoryMessageDto[] = [];
    for (const q of CONVERSATION) {
      const r = await run('conversation', q.id, q.text, [...history]);
      results.push(r);
      history.push({ role: 'user', content: q.text });
      if (r.res) history.push({ role: 'assistant', content: r.res.message, productSlugs: r.res.context.productSlugs });
    }
  } finally {
    await app.close();
  }

  console.log(`\n${'='.repeat(80)}\nSUMMARY\n${summaryTable(results)}`);
  if (outPath) {
    writeFileSync(outPath, toMarkdown(results, results.find((r) => r.res)?.res?.meta.model ?? 'unknown'));
    console.log(`\nWrote ${outPath}`);
  }
}

const toolSeq = (res?: ChatResponseDto) =>
  res ? res.toolTrace.map((t) => `${t.tool}${t.success ? '' : `[${t.errorCode}]`}`).join(' → ') || '(none)' : '(error)';

function print(r: Result): void {
  const res = r.res!;
  console.log(`\n${'='.repeat(80)}\n### ${r.id}: ${r.query}\n${'-'.repeat(80)}`);
  console.log(res.message);
  console.log(`\nTools (${res.toolTrace.length}): ${res.toolTrace.map((t) => `${t.tool}${t.success ? '' : `[${t.errorCode}]`}(${JSON.stringify(t.arguments)})`).join(' -> ') || '(none)'}`);
  console.log(`Actions: ${JSON.stringify(res.actions)}`);
  console.log(`Context: ${JSON.stringify(res.context)}`);
  console.log(`Internal terms in prose: ${r.leaks.join(', ') || 'none'}`);
  console.log(`Blocked checkout URL leaked: ${leaksBlockedUrl(res) ? 'YES' : 'no'}`);
  console.log(`Ungrounded tool arguments: ${r.argumentFindings.map((f) => `${f.argument}=${JSON.stringify(f.value)}`).join(', ') || 'none'}`);
}

function summaryTable(results: Result[]): string {
  const rows = [
    '| Id | Tool calls | Sequence | Internal terms in prose | Ungrounded args | Actions | Blocked URL leaked |',
    '|---|---|---|---|---|---|---|',
    ...results.map(
      (r) =>
        `| ${r.id} | ${r.res?.toolTrace.length ?? '-'} | ${toolSeq(r.res)} | ${r.leaks.join(', ') || 'none'} | ${
          r.argumentFindings.map((f) => `${f.argument}=${String(f.value)}`).join(', ') || 'none'
        } | ${r.res ? r.res.actions.map((a) => a.type).join(', ') || 'none' : '-'} | ${r.res ? (leaksBlockedUrl(r.res) ? 'YES' : 'no') : '-'} |`,
    ),
  ];
  return rows.join('\n');
}

function toMarkdown(results: Result[], model: string): string {
  const lines = [
    '# Connected prototype: live evaluation run',
    '',
    `- Captured at: ${new Date().toISOString()}`,
    `- Model: ${model}`,
    `- User timezone sent: ${TIMEZONE}`,
    '- Generated by `pnpm eval:ai` (responses verbatim). "Internal terms" and "ungrounded args" are automated heuristics.',
    '',
    '## Summary',
    '',
    summaryTable(results),
    '',
  ];
  let section: Result['section'] | null = null;
  for (const r of results) {
    if (r.section !== section) {
      section = r.section;
      lines.push(section === 'independent' ? '# Section 1: independent queries' : '# Section 2: conversational evaluation (history passed between turns)', '');
    }
    lines.push(`## ${r.id}: ${r.query}`, '');
    if (r.error) {
      lines.push(`ERROR: ${r.error}`, '');
      continue;
    }
    const res = r.res!;
    lines.push('### Response (verbatim)', '', res.message, '', '### Tool calls', '');
    for (const t of res.toolTrace) lines.push(`- \`${t.tool}\` ${t.success ? 'ok' : `failed (${t.errorCode})`} ${t.durationMs}ms — \`${JSON.stringify(t.arguments)}\``);
    if (res.toolTrace.length === 0) lines.push('- (none)');
    lines.push(
      '',
      `- Internal terms in prose: ${r.leaks.join(', ') || 'none'}`,
      `- Ungrounded tool arguments: ${r.argumentFindings.map((f) => `${f.argument}=${JSON.stringify(f.value)} (${f.reason})`).join('; ') || 'none'}`,
      `- Context returned: \`${JSON.stringify(res.context)}\``,
      '',
      '### Actions',
      '',
      '```json',
      JSON.stringify(res.actions, null, 2),
      '```',
      '',
    );
  }
  return lines.join('\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
