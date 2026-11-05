import type { ToolTraceEntry } from '../dto/chat.response';
import { auditToolArguments } from './argument-audit';

const search = (args: Record<string, unknown>): ToolTraceEntry => ({ tool: 'search_products', success: true, durationMs: 1, arguments: args, errorCode: null });

describe('auditToolArguments (evaluation heuristic)', () => {
  it('flags an invented IN_PERSON delivery mode (live v1 B6 case)', () => {
    const text = 'I want to start taking ballet classes regularly. Can I join the VSA annual program?';
    const findings = auditToolArguments(text, [search({ business: 'VSA', deliveryMode: 'IN_PERSON', q: 'annual' })]);
    expect(findings).toEqual([expect.objectContaining({ argument: 'deliveryMode', value: 'IN_PERSON' })]);
  });

  it('accepts normalised explicit concepts: "from home" -> ONLINE_LIVE, "annual" -> 12, "complete beginners" -> BEGINNER', () => {
    const text = "I'm looking for an annual online ballet program for complete beginners that I can join from home at Victory Skating.";
    expect(
      auditToolArguments(text, [search({ business: 'Victory Skating', discipline: 'BALLET', deliveryMode: 'ONLINE_LIVE', durationMonths: 12, level: 'BEGINNER' })]),
    ).toEqual([]);
  });

  it('flags filters with no basis for an ambiguous question', () => {
    const findings = auditToolArguments('Do I need ballet shoes and a mat?', [search({ discipline: 'BALLET', deliveryMode: 'ONLINE_LIVE', level: 'ADVANCED' })]);
    expect(findings.map((f) => f.argument).sort()).toEqual(['deliveryMode', 'level']);
  });

  it('accepts a no-filter catalog search', () => {
    expect(auditToolArguments('Is the program $3 per class?', [search({})])).toEqual([]);
  });

  it('flags an unmentioned business name', () => {
    expect(auditToolArguments('Do you have ballet?', [search({ business: 'Some Studio' })])[0]).toMatchObject({ argument: 'business' });
  });
});
