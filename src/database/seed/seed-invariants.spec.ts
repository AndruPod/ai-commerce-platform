import { CHECKOUT_URL, vsaSeed as d } from './vsa-annual-ballet.data';

// Guards the business rules of the seed: unknowns stay unknown, nothing is
// invented, and provenance is not silently upgraded.
describe('VSA seed invariants', () => {
  it('enrollment is OPEN only as unconfirmed prototype configuration, never from the landing page', () => {
    expect(d.enrollment.status).toBe('OPEN');
    expect(d.enrollment.provenance).toMatchObject({
      sourceType: 'PROTOTYPE_CONFIG',
      verificationStatus: 'UNCONFIRMED',
      sourceRef: 'Demo configuration for technical prototype; not confirmed by VSA',
    });
    expect(d.enrollment.effectiveFrom).toBeNull();
    expect(d.enrollment.effectiveUntil).toBeNull();
  });

  it('the schedule has no series start/end, so promotional dates cannot leak into the recurrence', () => {
    expect(d.schedule).not.toHaveProperty('seriesStartDate');
    expect(d.schedule).not.toHaveProperty('seriesEndDate');
  });

  it('no schedule exceptions are invented and exception coverage is unknown', () => {
    expect(d.scheduleExceptions).toEqual([]);
    expect(d.schedule.exceptionsConfirmedThrough).toBeNull();
    expect(d.schedule.exceptionsProvenance.verificationStatus).toBe('UNKNOWN');
  });

  it('the canonical timezone is an UNCONFIRMED modelling assumption', () => {
    expect(d.schedule.timezone).toBe('America/Los_Angeles');
    expect(d.schedule.timezoneProvenance.verificationStatus).toBe('UNCONFIRMED');
    expect(d.schedule.timezoneProvenance.sourceRef).toMatch(/assumption/i);
  });

  it('no requirements are invented', () => {
    expect(d.requirements).toEqual([]);
  });

  it('the checkout is the manually captured one: observed live, but its terms are CONFLICTING (not approved)', () => {
    expect(d.checkout).toMatchObject({
      checkoutType: 'EXTERNAL_CHECKOUT',
      provider: 'STRIPE',
      externalUrl: CHECKOUT_URL,
      status: 'ACTIVE',
      observedAmountMinor: 17900,
      observedCurrency: 'USD',
      observedBilling: 'ANNUAL',
      observedAt: '2026-10-03',
    });
    expect(d.checkout.provenance).toMatchObject({ sourceType: 'MANUAL_CHECKOUT_VERIFICATION', verificationStatus: 'CONFLICTING' });
    expect(d.checkout.provenance.sourceType).not.toBe('BUSINESS_APPROVED_CONFIG');
  });

  it('the observed checkout price does NOT change the authoritative offer', () => {
    expect(d.offer).toMatchObject({ amountMinor: 49900, currency: 'USD', pricingBasis: 'PACKAGE_TOTAL', paymentSchedule: 'UNKNOWN' });
  });

  it('the blocked checkout URL is not embedded in any exposed source reference or issue text', () => {
    const exposed = JSON.stringify([d.checkout.provenance, d.dataQualityIssues]);
    expect(exposed).not.toContain(CHECKOUT_URL);
    expect(exposed).not.toContain('buy.stripe.com');
  });

  it('the offer is $499 USD PACKAGE_TOTAL with UNKNOWN payment schedule and no per-class price', () => {
    expect(d.offer).toMatchObject({ amountMinor: 49900, currency: 'USD', pricingBasis: 'PACKAGE_TOTAL', paymentSchedule: 'UNKNOWN' });
    expect(JSON.stringify(d.offer)).not.toContain('$3');
  });

  it('"$3/class" exists only as a CONFLICTING data-quality claim', () => {
    const issue = d.dataQualityIssues.find((i) => i.rawClaim === '$3/class');
    expect(issue).toMatchObject({ fieldPath: 'offer.pricePerClass', issueType: 'CONFLICTING' });
  });

  it('access: 12 months CONFIRMED, start/end rules UNKNOWN', () => {
    expect(d.accessPolicy.entitlementDurationMonths).toBe(12);
    expect(d.accessPolicy.durationProvenance.verificationStatus).toBe('CONFIRMED');
    expect(d.accessPolicy.startRule).toBe('UNKNOWN');
    expect(d.accessPolicy.endRule).toBe('UNKNOWN');
  });

  it('nothing is tagged LANDING_PAGE, because the page has not been captured directly', () => {
    expect(JSON.stringify(d)).not.toContain('"LANDING_PAGE"');
  });

  it('seeds exactly the approved data-quality issues (no monthly-fee or promo-date issues yet)', () => {
    expect(d.dataQualityIssues.map((i) => [i.fieldPath, i.issueType, i.status ?? 'OPEN', i.blockingCode ?? null])).toEqual([
      ['offer.pricePerClass', 'CONFLICTING', 'OPEN', null],
      ['schedule.timezone', 'AMBIGUOUS', 'OPEN', null],
      ['program.includedClassCount', 'AMBIGUOUS', 'OPEN', null],
      ['checkout.externalUrl', 'MISSING', 'RESOLVED', null], // resolved by the manual capture
      ['requirements', 'MISSING', 'OPEN', null],
      ['checkout.price', 'CONFLICTING', 'OPEN', 'PRICE_CONFLICT'],
    ]);
  });

  it('the checkout price conflict is sourced from the manual verification and guesses no explanation', () => {
    const i = d.dataQualityIssues.find((x) => x.fieldPath === 'checkout.price')!;
    expect(i.claimSourceType).toBe('MANUAL_CHECKOUT_VERIFICATION');
    expect(i.explanation).toMatch(/has not been confirmed or explained by the business/);
    expect(i.explanation).not.toMatch(/promotion|stale|instal?lment|new price/i);
  });

  it('frames the 48-class vs weekly-Saturday issue as missing detail, not an error', () => {
    const i = d.dataQualityIssues.find((x) => x.fieldPath === 'program.includedClassCount')!;
    expect(i.explanation).toMatch(/not an error/);
  });
});
