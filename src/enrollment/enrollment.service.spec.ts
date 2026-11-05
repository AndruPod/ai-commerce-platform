import { enrollmentRow } from '../testing/fixtures';
import { buildEnrollmentView } from './enrollment.service';

const now = new Date('2026-10-03T12:00:00Z');

describe('buildEnrollmentView (row -> DTO mapping)', () => {
  it('keeps PROTOTYPE_CONFIG / UNCONFIRMED provenance visible', () => {
    const v = buildEnrollmentView([enrollmentRow()], '2026-11-06', now);
    expect(v).toMatchObject({
      status: 'OPEN',
      evaluatedForDate: '2026-11-06',
      basis: 'CURRENT_CONFIGURATION',
      window: { kind: 'OPEN_ENDED', effectiveFrom: null, effectiveUntil: null },
      provenance: {
        sourceType: 'PROTOTYPE_CONFIG',
        sourceRef: 'Demo configuration for technical prototype; not confirmed by VSA',
        verificationStatus: 'UNCONFIRMED',
      },
    });
    expect(v.basisNote).toMatch(/PROTOTYPE_CONFIG/);
    expect(v.independentOf).toEqual(expect.arrayContaining(['classSchedule', 'checkoutLink', 'promotionalDates']));
  });

  it('defaults the evaluated date to today (UTC)', () => {
    expect(buildEnrollmentView([enrollmentRow()], undefined, now).evaluatedForDate).toBe('2026-10-03');
  });

  it('labels bounded windows', () => {
    const v = buildEnrollmentView([enrollmentRow({ effectiveFrom: '2026-10-01', effectiveUntil: '2026-12-31' })], '2026-11-06', now);
    expect(v.window?.kind).toBe('BOUNDED');
  });
});
