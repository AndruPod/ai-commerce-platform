import { billingSuffix, checkoutBlockCopy, durationLabel, formatCalendarDate, formatMoney, levelLabel, provenanceNote, sortLevels, zoneLabel } from './labels';

describe('labels', () => {
  it('formats money without trailing zero cents', () => {
    expect(formatMoney(49900, 'USD')).toBe('$499 USD');
    expect(formatMoney(1040, 'USD')).toBe('$10.40 USD');
    expect(`${formatMoney(17900, 'USD')}${billingSuffix('ANNUAL')}`).toBe('$179 USD / year');
  });

  it('formats durations, dates and zones', () => {
    expect(durationLabel(12)).toBe('1 year');
    expect(durationLabel(6)).toBe('6 months');
    expect(formatCalendarDate('2026-11-06')).toBe('Friday, November 6, 2026');
    expect(zoneLabel('America/Los_Angeles')).toBe('Los Angeles time');
  });

  it('maps and orders experience levels', () => {
    expect(sortLevels(['PROFESSIONAL', 'BEGINNER', 'ADVANCED', 'RECREATIONAL']).map(levelLabel)).toEqual(['Beginner', 'Recreational', 'Advanced', 'Professional']);
  });

  it('turns provenance into plain language', () => {
    expect(provenanceNote({ sourceType: 'PROTOTYPE_CONFIG', sourceRef: null, verificationStatus: 'UNCONFIRMED', verifiedAt: null }, 'Biz')).toBe(
      'Shown as open in the prototype; not confirmed by Biz.',
    );
    expect(provenanceNote({ sourceType: 'BUSINESS_APPROVED_CONFIG', sourceRef: null, verificationStatus: 'CONFIRMED', verifiedAt: null }, 'Biz')).toBeNull();
  });

  it('describes checkout blocking codes', () => {
    expect(checkoutBlockCopy('PRICE_CONFLICT').headline).toBe('Verification required');
    expect(checkoutBlockCopy('URL_NOT_CAPTURED').headline).toBe('Not connected yet');
  });
});
