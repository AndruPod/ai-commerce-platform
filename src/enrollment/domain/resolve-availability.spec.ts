import type { Provenance } from '../../common/provenance/provenance';
import { AvailabilityWindow, resolveAvailability } from './resolve-availability';

const PROTO: Provenance = {
  sourceType: 'PROTOTYPE_CONFIG',
  sourceRef: 'Demo configuration for technical prototype; not confirmed by VSA',
  verificationStatus: 'UNCONFIRMED',
  verifiedAt: null,
};

const win = (o: Partial<AvailabilityWindow>): AvailabilityWindow => ({
  status: 'OPEN',
  effectiveFrom: null,
  effectiveUntil: null,
  notes: null,
  provenance: PROTO,
  configuredAt: '2026-10-03T00:00:00.000Z',
  ...o,
});

describe('resolveAvailability', () => {
  it('open-ended OPEN window resolves to OPEN based on current configuration for a future date', () => {
    const r = resolveAvailability([win({})], '2026-11-06', '2026-10-03');
    expect(r).toMatchObject({ status: 'OPEN', basis: 'CURRENT_CONFIGURATION', evaluatedForDate: '2026-11-06' });
    expect(r.window?.provenance).toEqual(PROTO);
  });

  it('returns UNKNOWN when no window is configured', () => {
    expect(resolveAvailability([], '2026-11-06', '2026-10-03')).toEqual({
      status: 'UNKNOWN',
      evaluatedForDate: '2026-11-06',
      basis: 'NO_CONFIGURATION',
      window: null,
    });
  });

  it('a bounded CLOSED window applies only inside its dates', () => {
    const windows = [win({}), win({ status: 'CLOSED', effectiveFrom: '2026-12-01', effectiveUntil: '2026-12-31' })];
    expect(resolveAvailability(windows, '2026-11-30', '2026-10-03').status).toBe('OPEN');
    expect(resolveAvailability(windows, '2026-12-01', '2026-10-03').status).toBe('CLOSED');
    expect(resolveAvailability(windows, '2026-12-31', '2026-10-03').status).toBe('CLOSED');
    expect(resolveAvailability(windows, '2027-01-01', '2026-10-03').status).toBe('OPEN');
  });

  it('returns UNKNOWN outside every configured window', () => {
    const r = resolveAvailability([win({ effectiveFrom: '2027-01-01' })], '2026-11-06', '2026-10-03');
    expect(r.status).toBe('UNKNOWN');
  });

  it('labels past dates as PAST_DATE', () => {
    expect(resolveAvailability([win({})], '2026-01-01', '2026-10-03').basis).toBe('PAST_DATE');
  });

  it('accepts no schedule/checkout/promotional input (enforced by its signature)', () => {
    expect(resolveAvailability.length).toBe(3);
  });
});
