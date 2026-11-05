import { evaluateCheckoutEligibility } from './checkout-eligibility';

const PRICE_CONFLICT = { code: 'PRICE_CONFLICT' as const, message: 'Offer and checkout prices conflict.' };
const base = { url: 'https://checkout.example/x', status: 'ACTIVE' as const, verificationStatus: 'UNCONFIRMED' as const, openBlockingIssues: [] };

describe('evaluateCheckoutEligibility', () => {
  it('A: a captured URL alone does not make checkout usable (status must be ACTIVE)', () => {
    expect(evaluateCheckoutEligibility({ ...base, status: 'UNVERIFIED' })).toEqual({
      usable: false,
      blockingIssues: [{ code: 'CHECKOUT_NOT_ACTIVE', message: 'The checkout has not been verified.' }],
    });
  });

  it('B: an OPEN material price conflict blocks an otherwise active checkout', () => {
    const r = evaluateCheckoutEligibility({ ...base, verificationStatus: 'CONFLICTING', openBlockingIssues: [PRICE_CONFLICT] });
    expect(r).toEqual({ usable: false, blockingIssues: [PRICE_CONFLICT] });
  });

  it('CONFLICTING verification blocks even without an explaining issue', () => {
    expect(evaluateCheckoutEligibility({ ...base, verificationStatus: 'CONFLICTING' }).blockingIssues.map((b) => b.code)).toEqual(['CHECKOUT_TERMS_CONFLICTING']);
  });

  it('a blocking issue blocks even if the checkout row itself is not marked conflicting', () => {
    expect(evaluateCheckoutEligibility({ ...base, openBlockingIssues: [PRICE_CONFLICT] }).usable).toBe(false);
  });

  it('no captured URL is never usable', () => {
    expect(evaluateCheckoutEligibility({ ...base, url: null, status: 'NOT_CAPTURED' })).toEqual({
      usable: false,
      blockingIssues: [{ code: 'URL_NOT_CAPTURED', message: 'The checkout URL has not been captured yet.' }],
    });
  });

  it('H: with the conflict resolved (issue closed, verification no longer conflicting), normal eligibility applies', () => {
    expect(evaluateCheckoutEligibility({ ...base, verificationStatus: 'CONFIRMED', openBlockingIssues: [] })).toEqual({ usable: true, blockingIssues: [] });
    // resolving only one side is not enough
    expect(evaluateCheckoutEligibility({ ...base, verificationStatus: 'CONFLICTING', openBlockingIssues: [] }).usable).toBe(false);
  });
});
