import { checkoutResponse, mockServices, SLUG, usableCheckout } from '../testing/ai-test-harness';
import type { ToolExecution } from '../tools/tool.types';
import { buildActions } from './actions';

const exec = (tool: string, data: unknown, ok = true): ToolExecution => ({
  tool,
  success: ok,
  durationMs: 1,
  arguments: {},
  errorCode: ok ? null : 'NOT_FOUND',
  result: ok ? { ok: true, data } : { ok: false, error: { code: 'NOT_FOUND', message: 'x' } },
});

const PRICE_CONFLICT = { code: 'PRICE_CONFLICT' as const, message: 'Offer and checkout prices conflict.' };

describe('buildActions', () => {
  it('returns no CHECKOUT action when the checkout URL is not captured, only CHECKOUT_UNAVAILABLE with the reason', () => {
    expect(buildActions([exec('get_checkout', checkoutResponse())])).toEqual([
      {
        type: 'CHECKOUT_UNAVAILABLE',
        label: 'Online payment unavailable',
        productSlug: SLUG,
        reasons: [{ code: 'URL_NOT_CAPTURED', message: 'The checkout URL has not been captured yet.' }],
      },
    ]);
  });

  it('D: a captured but price-conflicted checkout produces no CHECKOUT action, and the reason carries no URL', () => {
    const blocked = checkoutResponse({ status: 'ACTIVE', urlCaptured: true, url: null, urlWithheld: true, usable: false, blockingIssues: [PRICE_CONFLICT] });
    const actions = buildActions([exec('get_checkout', blocked)]);
    expect(actions.filter((a) => a.type === 'CHECKOUT')).toEqual([]);
    expect(actions).toEqual([expect.objectContaining({ type: 'CHECKOUT_UNAVAILABLE', reasons: [PRICE_CONFLICT] })]);
    expect(JSON.stringify(actions)).not.toMatch(/https?:/);
  });

  it('defence in depth: even if usable=true and a URL slipped through, an open blocking issue prevents CHECKOUT', () => {
    const inconsistent = checkoutResponse({ ...usableCheckout('https://pay.example/x'), blockingIssues: [PRICE_CONFLICT] });
    const actions = buildActions([exec('get_checkout', inconsistent)]);
    expect(actions.map((a) => a.type)).toEqual(['CHECKOUT_UNAVAILABLE']);
    expect(JSON.stringify(actions)).not.toContain('pay.example');
  });

  it('returns no CHECKOUT action when a URL exists but the domain says it is not usable', () => {
    const data = checkoutResponse({ status: 'UNVERIFIED', urlCaptured: true, url: 'https://checkout.example/annual', usable: false, blockingIssues: [{ code: 'CHECKOUT_NOT_ACTIVE', message: 'not verified' }] });
    expect(buildActions([exec('get_checkout', data)]).filter((a) => a.type === 'CHECKOUT')).toEqual([]);
  });

  it('H: once nothing blocks it, a usable checkout produces a CHECKOUT action with the domain URL and offer label', () => {
    expect(buildActions([exec('get_checkout', checkoutResponse(usableCheckout('https://checkout.example/annual')))])).toEqual([
      {
        type: 'CHECKOUT',
        label: 'Enroll — $100.00',
        url: 'https://checkout.example/annual',
        productSlug: SLUG,
        offer: { label: 'Package', amountMinor: 10000, currency: 'USD', display: '$100.00' },
        systemOfRecord: 'External checkout',
      },
    ]);
  });

  it('rejects non-http(s) URLs even if marked usable', () => {
    const actions = buildActions([exec('get_checkout', checkoutResponse(usableCheckout('javascript:alert(1)')))]);
    expect(actions.filter((a) => a.type === 'CHECKOUT')).toEqual([]);
  });

  it('builds VIEW_PRODUCT from successful get_product results and ignores failed tools', () => {
    const actions = buildActions([
      exec('get_product', { product: { slug: SLUG, name: 'Test Annual Program' }, dataQualityWarnings: { issues: [] } }),
      exec('get_product', null, false),
      exec('get_product', { product: { slug: SLUG, name: 'Test Annual Program' }, dataQualityWarnings: { issues: [] } }),
    ]);
    expect(actions).toEqual([{ type: 'VIEW_PRODUCT', label: 'Test Annual Program', productSlug: SLUG, apiPath: `/products/${SLUG}` }]);
  });

  it('works end-to-end with the executor output', async () => {
    const s = mockServices();
    const e = await s.executor.execute('get_checkout', JSON.stringify({ productSlug: SLUG }), { userTimezone: null });
    expect(buildActions([e]).filter((a) => a.type === 'CHECKOUT')).toEqual([]);
  });
});
