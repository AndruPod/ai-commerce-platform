import { checkPerClassPriceClaim, formatMinor, parsePerClassClaim } from './price-claim';

describe('parsePerClassClaim', () => {
  it.each([
    ['$3/class', 300, '$'],
    [' $10.40 per class ', 1040, '$'],
    ['3/class', 300, null],
  ])('parses %p', (raw, amountMinor, currencySymbol) => {
    expect(parsePerClassClaim(raw)).toEqual({ amountMinor, currencySymbol });
  });

  it('returns null for unparseable text', () => {
    expect(parsePerClassClaim('cheap!')).toBeNull();
  });
});

describe('checkPerClassPriceClaim', () => {
  const base = { packageAmountMinor: 49900, currency: 'USD', includedClassCount: 48 };

  it('$499 / 48 classes ≈ $10.40, so "$3/class" is CONFLICTING', () => {
    const r = checkPerClassPriceClaim({ ...base, claim: parsePerClassClaim('$3/class')! });
    expect(r.verdict).toBe('CONFLICTING');
    expect(r.derivedPerClassMinor).toBe(1040);
    expect(formatMinor(r.derivedPerClassMinor, 'USD')).toBe('$10.40');
  });

  it('a claim matching the rounded per-class amount is CONSISTENT', () => {
    expect(checkPerClassPriceClaim({ ...base, claim: { amountMinor: 1040, currencySymbol: '$' } }).verdict).toBe('CONSISTENT');
  });

  it('a claim in a different currency is NOT_COMPARABLE', () => {
    expect(checkPerClassPriceClaim({ ...base, claim: { amountMinor: 300, currencySymbol: '£' } }).verdict).toBe('NOT_COMPARABLE');
  });
});
