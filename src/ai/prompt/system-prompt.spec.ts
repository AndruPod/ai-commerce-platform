import { CHECKOUT_URL, vsaSeed, LANDING_PAGE_URL } from '../../database/seed/vsa-annual-ballet.data';
import { formatMinor } from '../../product/domain/price-claim';
import { WEEKDAYS } from '../../common/enums';
import { runtimeContext, SYSTEM_PROMPT } from './system-prompt';
import { mockServices } from '../testing/ai-test-harness';

/**
 * The prompt describes behaviour only. Business facts must come from tools,
 * so none of the seeded commerce values may appear in prompt or tool text.
 */
describe('system prompt and tool definitions contain no hardcoded commerce facts', () => {
  const toolText = JSON.stringify(mockServices().executor.definitions());
  const texts = { prompt: SYSTEM_PROMPT, tools: toolText };

  const forbidden: (string | RegExp)[] = [
    vsaSeed.business.canonicalName,
    'Victory',
    ...vsaSeed.business.aliases,
    vsaSeed.product.name,
    vsaSeed.product.slug,
    vsaSeed.coach.displayName,
    formatMinor(vsaSeed.offer.amountMinor, vsaSeed.offer.currency),
    String(vsaSeed.offer.amountMinor / 100),
    new RegExp(`\\b${vsaSeed.program.includedClassCount}\\b`),
    new RegExp(`\\b${vsaSeed.program.classDurationMinutes}\\s*min`, 'i'),
    new RegExp(`\\b${vsaSeed.accessPolicy.entitlementDurationMonths}[- ]month`, 'i'),
    new RegExp(WEEKDAYS[vsaSeed.schedule.isoWeekday - 1], 'i'),
    vsaSeed.schedule.timezone,
    vsaSeed.schedule.localStartTime,
    ...vsaSeed.schedule.publishedTimeLabels,
    LANDING_PAGE_URL,
    'victoryskating',
    '$3',
    '10.40',
    // captured checkout conflict (J)
    CHECKOUT_URL,
    'buy.stripe',
    'Stripe',
    '179',
    vsaSeed.checkout.observedProductLabel,
    'weekly classes',
    /ballet shoes|leotard|\bmat\b/i,
  ];

  for (const [where, text] of Object.entries(texts)) {
    it.each(forbidden.map((f) => [String(f), f]))(`${where} does not contain %s`, (_label, f) => {
      if (f instanceof RegExp) expect(text).not.toMatch(f);
      else expect(text.toLowerCase()).not.toContain(f.toLowerCase());
    });
  }

  it('the per-request context carries only date/timezone when no product is established', () => {
    expect(runtimeContext({ now: new Date('2026-10-03T12:00:00Z'), userTimezone: 'Europe/London', knownProductSlugs: [] })).toBe(
      'Current date and time (UTC): 2026-10-03T12:00:00.000Z.\nUser timezone: Europe/London. Interpret dates the user mentions in this timezone.',
    );
  });

  it('the per-request context lists products established earlier in the conversation', () => {
    const ctx = runtimeContext({ now: new Date('2026-10-03T12:00:00Z'), userTimezone: null, knownProductSlugs: ['some-product'] });
    expect(ctx).toContain('Products already identified in this conversation');
    expect(ctx).toContain('some-product');
  });

  it('covers the generic policy areas', () => {
    for (const s of ['## Grounding', '## Product resolution', '## Tool arguments', '## Separate concepts', '## Prices and claims', '## Actionability', '## Presentation']) {
      expect(SYSTEM_PROMPT).toContain(s);
    }
  });

  it('requires search before clarification and forbids invented filters (generic wording)', () => {
    expect(SYSTEM_PROMPT).toMatch(/do not ask which one first\. Call search_products with only the signals the user actually gave/);
    expect(SYSTEM_PROMPT).toMatch(/Never guess a value the user did not imply; when unsure, omit the filter/);
    expect(SYSTEM_PROMPT).toMatch(/Ask the user to choose only when several materially different products remain plausible/);
  });

  it('requires natural-language presentation of codes while keeping uncertainty', () => {
    expect(SYSTEM_PROMPT).toMatch(/Never show tool names, field names, slugs or raw codes/);
    expect(SYSTEM_PROMPT).toMatch(/Keep every uncertainty/);
  });

  it('contains generic transaction-safety rules', () => {
    expect(SYSTEM_PROMPT).toMatch(/If checkout is not usable, never offer payment, a link or a workaround/);
    expect(SYSTEM_PROMPT).toMatch(/Never choose between them or call either one the correct or current price/);
  });

  it('requires the join flow to continue to checkout, but not for informational questions', () => {
    expect(SYSTEM_PROMPT).toMatch(/then call get_checkout/);
    expect(SYSTEM_PROMPT).toMatch(/Do not call get_checkout for purely informational questions/);
  });

  it('contains the generic presentation refinements (pricing basis, no promised capabilities, no volunteered derived prices, no codes)', () => {
    expect(SYSTEM_PROMPT).toMatch(/never restate a package total as a per-period/);
    expect(SYSTEM_PROMPT).toMatch(/Never promise monitoring, notifications, reminders or later follow-up/);
    expect(SYSTEM_PROMPT).toMatch(/do not volunteer them, especially derived unit prices when a pricing claim conflicts/);
    expect(SYSTEM_PROMPT).toMatch(/never as capitalised codes/);
  });

  it('asks for short, direct customer-facing answers without audit narration', () => {
    expect(SYSTEM_PROMPT).toMatch(/usually 2-4 short paragraphs or one compact list, roughly under 120 words\. Start with the direct answer/);
    expect(SYSTEM_PROMPT).toMatch(/no section headings \(such as "Details" or "What I checked"\) unless the user asks for technical details/);
    expect(SYSTEM_PROMPT).toMatch(/Then stop; do not add lists of options or next steps/);
  });

  it('stays concise', () => {
    expect(SYSTEM_PROMPT.length).toBeLessThan(7000);
  });

  it('search tool parameters tell the model to set filters only when stated', () => {
    const search = mockServices().executor.definitions().find((d) => d.function.name === 'search_products')!;
    const props = (search.function.parameters as { properties: Record<string, { description?: string }> }).properties;
    for (const f of ['business', 'discipline', 'deliveryMode', 'level', 'durationMonths']) {
      expect(props[f].description).toMatch(/Set only if the user stated or clearly implied it/);
    }
    expect(search.function.parameters).toMatchObject({ required: [] });
  });
});
