import {
  evaluateDate,
  EvaluateDateInput,
  NOTE_CANDIDATE_UNCONFIRMED,
  RecurrenceRule,
  ScheduleEvaluationError,
} from './evaluate-date';

const RULE: RecurrenceRule = {
  frequency: 'WEEKLY',
  isoWeekday: 6,
  localStartTime: '11:00:00',
  durationMinutes: 60,
  timezone: 'America/Los_Angeles',
};
const DISPLAY = ['America/New_York', 'Europe/London', 'Europe/Berlin', 'UTC'];

function input(overrides: Partial<EvaluateDateInput> = {}): EvaluateDateInput {
  return {
    rule: RULE,
    exceptions: [],
    exceptionsConfirmedThrough: null,
    displayTimezones: DISPLAY,
    count: 3,
    now: new Date('2026-10-03T12:00:00Z'),
    ...overrides,
  };
}

function computable(i: EvaluateDateInput) {
  const r = evaluateDate(i);
  if (!r.computable) throw new Error('expected computable evaluation');
  return r;
}

describe('evaluateDate', () => {
  describe('requested date 2026-11-06 (Friday)', () => {
    const r = computable(input({ requestedDate: '2026-11-06' }));

    it('recognises Friday and that it does not match the Saturday recurrence', () => {
      expect(r.requestedDate).toMatchObject({
        date: '2026-11-06',
        weekday: 'FRIDAY',
        matchesRecurrence: false,
        interpretedInTimezone: 'America/Los_Angeles',
        timezoneSource: 'SCHEDULE_CANONICAL_TIMEZONE',
        occurrencesOnDate: [],
      });
    });

    it('returns 2026-11-07 as next candidate, unconfirmed, with correct IANA conversions', () => {
      const next = r.nextCandidateOccurrences[0];
      expect(next.scheduleLocalDate).toBe('2026-11-07');
      expect(next.status).toBe('CANDIDATE_UNCONFIRMED');
      expect(next.statusNote).toBe(NOTE_CANDIDATE_UNCONFIRMED);
      expect(next.startsAtUtc).toBe('2026-11-07T19:00:00Z');
      expect(next.endsAtUtc).toBe('2026-11-07T20:00:00Z');
      expect(next.localTimes['America/Los_Angeles']).toMatchObject({ localTime: '11:00', abbreviation: 'PST', utcOffset: '-08:00' });
      expect(next.localTimes['America/New_York']).toMatchObject({ localTime: '14:00', abbreviation: 'EST' });
      expect(next.localTimes['Europe/London']).toMatchObject({ localTime: '19:00', abbreviation: 'GMT' });
      expect(next.localTimes['Europe/Berlin']).toMatchObject({ localTime: '20:00', abbreviation: 'CET' });
      expect(next.localTimes['UTC']).toMatchObject({ localTime: '19:00' });
    });

    it('reports exception knowledge as NOT_PROVIDED and returns weekly Saturdays', () => {
      expect(r.exceptionsKnowledge).toEqual({ status: 'NOT_PROVIDED', confirmedThrough: null });
      expect(r.nextCandidateOccurrences.map((o) => o.scheduleLocalDate)).toEqual(['2026-11-07', '2026-11-14', '2026-11-21']);
    });
  });

  it('a Saturday matches the recurrence but is only a candidate without exception coverage', () => {
    const r = computable(input({ requestedDate: '2026-11-07' }));
    expect(r.requestedDate?.matchesRecurrence).toBe(true);
    expect(r.requestedDate?.weekday).toBe('SATURDAY');
    expect(r.requestedDate?.occurrencesOnDate[0].status).toBe('CANDIDATE_UNCONFIRMED');
    expect(r.requestedDate?.note).toBe(NOTE_CANDIDATE_UNCONFIRMED);
  });

  describe('DST transitions (published labels are evidence, not fixed offsets)', () => {
    it('summer Saturday 2026-07-11: 11:00 PDT = 14:00 EDT = 19:00 BST = 20:00 CEST', () => {
      const o = computable(input({ requestedDate: '2026-07-11' })).requestedDate!.occurrencesOnDate[0];
      expect(o.startsAtUtc).toBe('2026-07-11T18:00:00Z');
      expect(o.localTimes['America/Los_Angeles']).toMatchObject({ localTime: '11:00', abbreviation: 'PDT' });
      expect(o.localTimes['America/New_York']).toMatchObject({ localTime: '14:00', abbreviation: 'EDT' });
      expect(o.localTimes['Europe/London']).toMatchObject({ localTime: '19:00', abbreviation: 'BST' });
      expect(o.localTimes['Europe/Berlin']).toMatchObject({ localTime: '20:00', abbreviation: 'CEST' });
    });

    it('2026-10-31 (Europe already on winter time, US not yet): UK is 18:00, not the published 19:00', () => {
      const o = computable(input({ requestedDate: '2026-10-31' })).requestedDate!.occurrencesOnDate[0];
      expect(o.startsAtUtc).toBe('2026-10-31T18:00:00Z');
      expect(o.localTimes['America/Los_Angeles']).toMatchObject({ localTime: '11:00', abbreviation: 'PDT' });
      expect(o.localTimes['America/New_York']).toMatchObject({ localTime: '14:00', abbreviation: 'EDT' });
      expect(o.localTimes['Europe/London']).toMatchObject({ localTime: '18:00', abbreviation: 'GMT' });
      expect(o.localTimes['Europe/Berlin']).toMatchObject({ localTime: '19:00', abbreviation: 'CET' });
    });

    it('2026-11-07 (both on winter time): back to 19:00 UK / 20:00 Berlin, UTC start shifts to 19:00', () => {
      const o = computable(input({ requestedDate: '2026-11-07' })).requestedDate!.occurrencesOnDate[0];
      expect(o.startsAtUtc).toBe('2026-11-07T19:00:00Z');
      expect(o.localTimes['Europe/London'].localTime).toBe('19:00');
      expect(o.localTimes['Europe/Berlin'].localTime).toBe('20:00');
    });
  });

  describe('viewer timezone', () => {
    it('interprets the requested date in the viewer timezone (Saturday 11:00 LA is Sunday in Tokyo)', () => {
      const sat = computable(input({ requestedDate: '2026-11-07', viewerTimezone: 'Asia/Tokyo' }));
      expect(sat.requestedDate).toMatchObject({ matchesRecurrence: false, timezoneSource: 'REQUEST_TZ_PARAM', interpretedInTimezone: 'Asia/Tokyo' });
      const sun = computable(input({ requestedDate: '2026-11-08', viewerTimezone: 'Asia/Tokyo' }));
      expect(sun.requestedDate?.matchesRecurrence).toBe(true);
      expect(sun.requestedDate?.occurrencesOnDate[0].localTimes['Asia/Tokyo']).toMatchObject({ localDate: '2026-11-08', localTime: '04:00', weekday: 'SUNDAY' });
    });

    it('rejects an invalid timezone instead of silently falling back', () => {
      expect(() => evaluateDate(input({ requestedDate: '2026-11-06', viewerTimezone: 'Mars/Olympus' }))).toThrow(ScheduleEvaluationError);
    });

    it('rejects an invalid calendar date', () => {
      expect(() => evaluateDate(input({ requestedDate: '2026-02-30' }))).toThrow(ScheduleEvaluationError);
    });
  });

  describe('exceptions', () => {
    it('marks occurrences inside confirmed coverage as SCHEDULED_CONFIRMED and later ones as candidates', () => {
      const r = computable(input({ requestedDate: '2026-11-06', exceptionsConfirmedThrough: '2026-11-14' }));
      expect(r.exceptionsKnowledge).toEqual({ status: 'CONFIRMED_THROUGH', confirmedThrough: '2026-11-14' });
      expect(r.nextCandidateOccurrences.map((o) => o.status)).toEqual([
        'SCHEDULED_CONFIRMED',
        'SCHEDULED_CONFIRMED',
        'CANDIDATE_UNCONFIRMED',
      ]);
    });

    it('applies only stored exceptions: cancelled, rescheduled and additional', () => {
      const r = computable(
        input({
          requestedDate: '2026-11-06',
          count: 3,
          exceptions: [
            { type: 'CANCELLED', originalDate: '2026-11-07', replacementDate: null, replacementStartTime: null, reason: 'Test', verificationStatus: 'CONFIRMED' },
            { type: 'RESCHEDULED', originalDate: '2026-11-14', replacementDate: '2026-11-15', replacementStartTime: '10:00', reason: null, verificationStatus: 'UNCONFIRMED' },
            { type: 'ADDITIONAL', originalDate: null, replacementDate: '2026-11-18', replacementStartTime: '11:00', reason: null, verificationStatus: 'CONFIRMED' },
          ],
        }),
      );
      expect(r.nextCandidateOccurrences.map((o) => [o.scheduleLocalDate, o.status])).toEqual([
        ['2026-11-07', 'CANCELLED'],
        ['2026-11-15', 'RESCHEDULED'],
        ['2026-11-18', 'ADDITIONAL'],
        ['2026-11-21', 'CANDIDATE_UNCONFIRMED'],
      ]);
      expect(r.nextCandidateOccurrences[1].originalDate).toBe('2026-11-14');
    });

    it('notes a cancellation on a requested date that otherwise matches', () => {
      const r = computable(
        input({
          requestedDate: '2026-11-07',
          exceptions: [{ type: 'CANCELLED', originalDate: '2026-11-07', replacementDate: null, replacementStartTime: null, reason: null, verificationStatus: 'CONFIRMED' }],
        }),
      );
      expect(r.requestedDate?.matchesRecurrence).toBe(true);
      expect(r.requestedDate?.occurrencesOnDate[0].status).toBe('CANCELLED');
      expect(r.requestedDate?.note).toMatch(/cancels/);
    });
  });

  it('without a requested date, starts from now', () => {
    const r = computable(input({ now: new Date('2026-10-03T19:30:00Z') })); // after the 18:00Z class on Sat Oct 3
    expect(r.requestedDate).toBeNull();
    expect(r.nextCandidateOccurrences[0].scheduleLocalDate).toBe('2026-10-10');
  });

  it('does not compute occurrences when the timezone or start time is unknown', () => {
    expect(evaluateDate(input({ rule: { ...RULE, timezone: null } }))).toMatchObject({ computable: false, notComputableReason: 'SCHEDULE_TIMEZONE_UNKNOWN' });
    expect(evaluateDate(input({ rule: { ...RULE, localStartTime: null } }))).toMatchObject({ computable: false, notComputableReason: 'LOCAL_START_TIME_UNKNOWN' });
  });
});
