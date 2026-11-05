import { buildIssueEvidence, CheckoutPriceEvidence, PerClassEvidence } from './issue-evidence';

const ctx = {
  offer: { amountMinor: 49900, currency: 'USD', pricingBasis: 'PACKAGE_TOTAL' as const, sourceType: 'ASSIGNMENT_BRIEF' as const },
  program: { includedClassCount: 48 },
  checkoutObservation: { amountMinor: 17900, currency: 'USD', billing: 'ANNUAL' as const, observedAt: '2026-10-03' },
};

describe('buildIssueEvidence', () => {
  it('produces DERIVED, non-published evidence for the $3/class claim', () => {
    const e = buildIssueEvidence({ fieldPath: 'offer.pricePerClass', rawClaim: '$3/class' }, ctx) as PerClassEvidence;
    expect(e.derivedPricePerIncludedClass).toEqual({
      value: { amountMinor: 1040, currency: 'USD', display: '$10.40', approximate: true },
      sourceType: 'DERIVED',
      derivedFrom: ['offer.amountMinor', 'program.includedClassCount'],
      isPublishedFact: false,
    });
    expect(e.claimComparison.value.verdict).toBe('CONFLICTING');
    expect(e.claimComparison.isPublishedFact).toBe(false);
  });

  it('checkout.price: both amounts keep their own source types; only the comparison is DERIVED', () => {
    const e = buildIssueEvidence({ fieldPath: 'checkout.price', rawClaim: 'x' }, ctx) as CheckoutPriceEvidence;
    expect(e.authoritativeOffer).toEqual({ amountMinor: 49900, currency: 'USD', display: '$499.00', pricingBasis: 'PACKAGE_TOTAL', sourceType: 'ASSIGNMENT_BRIEF' });
    expect(e.observedCheckout).toEqual({ amountMinor: 17900, currency: 'USD', display: '$179.00', billing: 'ANNUAL', observedAt: '2026-10-03', sourceType: 'MANUAL_CHECKOUT_VERIFICATION' });
    expect(e.comparison).toEqual({
      value: { amountsMatch: false, sameCurrency: true, differenceMinor: 32000, resolution: 'UNRESOLVED' },
      sourceType: 'DERIVED',
      derivedFrom: ['offer.amountMinor', 'checkout.observedAmountMinor'],
      isPublishedFact: false,
    });
  });

  it('checkout.price: no evidence without an observation', () => {
    expect(buildIssueEvidence({ fieldPath: 'checkout.price', rawClaim: 'x' }, { ...ctx, checkoutObservation: null })).toBeNull();
  });

  it('returns no evidence for other issues', () => {
    expect(buildIssueEvidence({ fieldPath: 'schedule.timezone', rawClaim: 'x' }, ctx)).toBeNull();
  });
});
