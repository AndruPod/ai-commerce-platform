import { findInternalTerms } from './presentation-audit';

describe('findInternalTerms', () => {
  it('flags raw codes, field names and tool names copied into prose', () => {
    const leaky =
      'Enrollment: OPEN. Provenance: sourceType = PROTOTYPE_CONFIG, verificationStatus = UNCONFIRMED. pricingBasis: PACKAGE_TOTAL; paymentSchedule UNKNOWN. Status: CANDIDATE_UNCONFIRMED. I can call get_checkout.';
    expect(findInternalTerms(leaky)).toEqual(
      expect.arrayContaining(['OPEN', 'sourceType', 'PROTOTYPE_CONFIG', 'verificationStatus', 'UNCONFIRMED', 'pricingBasis', 'PACKAGE_TOTAL', 'paymentSchedule', 'UNKNOWN', 'CANDIDATE_UNCONFIRMED', 'get_checkout']),
    );
  });

  it('accepts natural-language uncertainty', () => {
    const natural =
      'The prototype currently shows enrollment as open, but this has not been confirmed by the business. The available product information does not specify whether the price is paid in one payment or another arrangement. Saturday sessions match the regular schedule, but cancellation data for that date has not been confirmed. It is unknown when access starts.';
    expect(findInternalTerms(natural)).toEqual([]);
  });

  it('does not flag codes inside longer identifiers or lower-case words', () => {
    expect(findInternalTerms('an unknown, open question; my-slug-value')).toEqual([]);
  });
});
