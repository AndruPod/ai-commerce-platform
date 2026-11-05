import { accessPolicyRow, offerRow } from '../testing/fixtures';
import { toAccessPolicy, toOffer, toRequirements } from './product.mapper';

describe('product mapper', () => {
  it('maps the annual offer as $499 USD PACKAGE_TOTAL with UNKNOWN payment schedule', () => {
    const o = toOffer(offerRow());
    expect(o).toMatchObject({
      label: 'Annual package',
      price: { amountMinor: 49900, currency: 'USD', display: '$499.00' },
      pricingBasis: 'PACKAGE_TOTAL',
      paymentSchedule: 'UNKNOWN',
      provenance: { sourceType: 'ASSIGNMENT_BRIEF', verificationStatus: 'CONFIRMED' },
    });
    expect(JSON.stringify(o)).not.toMatch(/perClass|\$3|10\.40/);
  });

  it('maps an unknown price to null instead of 0', () => {
    expect(toOffer(offerRow({ amountMinor: null, currency: null })).price).toBeNull();
  });

  it('access policy keeps confirmed duration separate from unknown boundary rules', () => {
    const a = toAccessPolicy(accessPolicyRow());
    expect(a.entitlementDuration).toMatchObject({ value: { months: 12 }, provenance: { verificationStatus: 'CONFIRMED' } });
    expect(a.startRule).toMatchObject({ value: 'UNKNOWN', provenance: { verificationStatus: 'UNKNOWN' } });
    expect(a.endRule).toMatchObject({ value: 'UNKNOWN', provenance: { verificationStatus: 'UNKNOWN' } });
    expect(a.completeness).toBe('PARTIAL');
    expect(a.computedAccessWindow).toBeNull();
  });

  it('empty requirements are NOT_PROVIDED, not "none"', () => {
    expect(toRequirements([])).toMatchObject({ knowledge: 'NOT_PROVIDED', items: [] });
    expect(toRequirements([]).note).toMatch(/does not mean there are none/);
  });
});
