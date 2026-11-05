import { cancelledException, scheduleRow } from '../testing/fixtures';
import { buildScheduleView } from './schedule.service';

const now = new Date('2026-10-03T12:00:00Z');

describe('buildScheduleView (row -> DTO mapping)', () => {
  const view = buildScheduleView(scheduleRow(), [], { date: '2026-11-06' }, now);

  it('maps the recurrence with separate provenance for the timezone', () => {
    expect(view.recurrence).toMatchObject({ frequency: 'WEEKLY', weekday: 'SATURDAY', isoWeekday: 6, localStartTime: '11:00', durationMinutes: 60 });
    expect(view.recurrence.provenance.verificationStatus).toBe('CONFIRMED');
    expect(view.recurrence.canonicalTimezone).toMatchObject({
      value: 'America/Los_Angeles',
      provenance: { sourceType: 'ASSIGNMENT_BRIEF', verificationStatus: 'UNCONFIRMED' },
    });
    expect(view.recurrence.publishedTimeLabels.labels).toEqual(['11:00–12:00 PDT', '14:00–15:00 EDT', '19:00–20:00 UK', '20:00–21:00 CEST']);
  });

  it('distinguishes "no exceptions provided" from "no exceptions"', () => {
    expect(view.exceptions.knowledge.status).toBe('NOT_PROVIDED');
    expect(view.exceptions.items).toEqual([]);
    expect(view.exceptions.note).toMatch(/does NOT mean there are no exceptions/);
  });

  it('describes a non-empty but incomplete exception list as incomplete', () => {
    const v = buildScheduleView(scheduleRow(), [cancelledException('2026-11-14')], { date: '2026-11-06' }, now);
    expect(v.exceptions.items).toHaveLength(1);
    expect(v.exceptions.note).toMatch(/not known to be complete/);
  });

  it('describes confirmed coverage with its end date', () => {
    const v = buildScheduleView(scheduleRow({ exceptionsConfirmedThrough: '2026-12-31' }), [], {}, now);
    expect(v.exceptions.knowledge).toMatchObject({ status: 'CONFIRMED_THROUGH', confirmedThrough: '2026-12-31' });
  });

  it('exposes no raw database columns', () => {
    const json = JSON.stringify(view);
    for (const col of ['productId', 'tzSourceType', 'createdAt', 'iso_weekday']) expect(json).not.toContain(col);
  });

  it('reports a non-computable schedule when the timezone is unknown', () => {
    const v = buildScheduleView(scheduleRow({ timezone: null }), [], { date: '2026-11-06' }, now);
    expect(v.computation).toEqual({ computable: false, notComputableReason: 'SCHEDULE_TIMEZONE_UNKNOWN', referenceTimezone: null });
    expect(v.nextCandidateOccurrences).toEqual([]);
  });
});
