import { buildEnrollmentView } from '../../enrollment/enrollment.service';
import { buildScheduleView } from '../../schedule/schedule.service';
import { enrollmentRow, scheduleRow } from '../../testing/fixtures';
import { buildDateCheckLimitations } from './limitations';

const now = new Date('2026-10-03T12:00:00Z');
const codes = (...args: Parameters<typeof buildDateCheckLimitations>) => buildDateCheckLimitations(...args).map((l) => l.code);

describe('buildDateCheckLimitations', () => {
  it('flags unknown enrollment instead of unconfirmed', () => {
    const c = codes(buildEnrollmentView([], '2026-11-06', now), buildScheduleView(scheduleRow(), [], { date: '2026-11-06' }, now));
    expect(c).toContain('ENROLLMENT_STATUS_UNKNOWN');
    expect(c).not.toContain('ENROLLMENT_STATUS_UNCONFIRMED');
  });

  it('does not flag confirmed business-approved enrollment or a confirmed timezone', () => {
    const enrollment = buildEnrollmentView(
      [enrollmentRow({ sourceType: 'BUSINESS_APPROVED_CONFIG', verificationStatus: 'CONFIRMED' })],
      '2026-11-06',
      now,
    );
    const schedule = buildScheduleView(scheduleRow({ tzVerificationStatus: 'CONFIRMED' }), [], { date: '2026-11-06' }, now);
    expect(codes(enrollment, schedule)).toEqual(['ENROLLMENT_AND_SCHEDULE_ARE_INDEPENDENT', 'SCHEDULE_EXCEPTIONS_NOT_PROVIDED']);
  });

  it('flags partial exception coverage when later candidates remain unconfirmed', () => {
    const schedule = buildScheduleView(scheduleRow({ exceptionsConfirmedThrough: '2026-11-07' }), [], { date: '2026-11-06' }, now);
    expect(codes(buildEnrollmentView([enrollmentRow()], '2026-11-06', now), schedule)).toContain('SCHEDULE_EXCEPTIONS_PARTIALLY_CONFIRMED');
  });

  it('flags a missing schedule', () => {
    expect(codes(buildEnrollmentView([enrollmentRow()], '2026-11-06', now), null)).toContain('NO_SCHEDULE_CONFIGURED');
  });
});
