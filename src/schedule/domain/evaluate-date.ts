import { DateTime, IANAZone } from 'luxon';
import { ScheduleExceptionType, VerificationStatus, Weekday, WEEKDAYS } from '../../common/enums';

/**
 * Pure schedule reasoning. Knows nothing about enrollment, checkout or access:
 * it only expands the recurring rule, applies explicitly stored exceptions and
 * reports how much of that is actually confirmed.
 */

export type OccurrenceStatus =
  | 'SCHEDULED_CONFIRMED' // inside confirmed exception coverage, no exception stored
  | 'CANDIDATE_UNCONFIRMED' // matches the rule, but exception coverage for this date is unknown
  | 'CANCELLED'
  | 'RESCHEDULED'
  | 'ADDITIONAL';

export type ExceptionsKnowledge =
  | { status: 'NOT_PROVIDED'; confirmedThrough: null }
  | { status: 'CONFIRMED_THROUGH'; confirmedThrough: string };

export interface RecurrenceRule {
  frequency: 'WEEKLY';
  isoWeekday: number;
  /** "HH:mm" or "HH:mm:ss"; null when unknown. */
  localStartTime: string | null;
  durationMinutes: number;
  /** IANA zone; null when unknown. */
  timezone: string | null;
}

export interface ScheduleExceptionInput {
  type: ScheduleExceptionType;
  originalDate: string | null;
  replacementDate: string | null;
  replacementStartTime: string | null;
  reason: string | null;
  verificationStatus: VerificationStatus;
}

export interface EvaluateDateInput {
  rule: RecurrenceRule;
  exceptions: ScheduleExceptionInput[];
  exceptionsConfirmedThrough: string | null;
  /** Calendar date "YYYY-MM-DD". When omitted, upcoming occurrences start from `now`. */
  requestedDate?: string | null;
  /** Caller's IANA timezone, used to interpret `requestedDate`. Defaults to the schedule timezone. */
  viewerTimezone?: string | null;
  /** Timezones to render every occurrence in, in addition to the schedule and viewer timezones. */
  displayTimezones: string[];
  count: number;
  now: Date;
}

export interface ZonedTime {
  localDate: string;
  localTime: string;
  weekday: Weekday;
  abbreviation: string;
  utcOffset: string;
}

export interface Occurrence {
  status: OccurrenceStatus;
  statusNote: string;
  /** Local date in the schedule timezone. */
  scheduleLocalDate: string;
  startsAtUtc: string;
  endsAtUtc: string;
  localTimes: Record<string, ZonedTime>;
  /** For RESCHEDULED: the regular date it was moved from. */
  originalDate: string | null;
  exception: { type: ScheduleExceptionType; reason: string | null; verificationStatus: VerificationStatus } | null;
}

export interface RequestedDateResult {
  date: string;
  interpretedInTimezone: string;
  timezoneSource: 'REQUEST_TZ_PARAM' | 'SCHEDULE_CANONICAL_TIMEZONE';
  weekday: Weekday;
  /** True when a regular (pre-exception) recurrence slot falls on this date. */
  matchesRecurrence: boolean;
  /** Effective sessions on this date after stored exceptions are applied. */
  occurrencesOnDate: Occurrence[];
  note: string;
}

export type DateEvaluation =
  | {
      computable: true;
      referenceTimezone: string;
      exceptionsKnowledge: ExceptionsKnowledge;
      requestedDate: RequestedDateResult | null;
      nextCandidateOccurrences: Occurrence[];
    }
  | {
      computable: false;
      notComputableReason: 'SCHEDULE_TIMEZONE_UNKNOWN' | 'LOCAL_START_TIME_UNKNOWN';
      exceptionsKnowledge: ExceptionsKnowledge;
      requestedDate: null;
      nextCandidateOccurrences: [];
    };

export class ScheduleEvaluationError extends Error {}

export const NOTE_CANDIDATE_UNCONFIRMED =
  'This date matches the recurring schedule, but no exception data has been confirmed for this period. It is not a guarantee that the class takes place.';

export function isValidIanaZone(zone: string): boolean {
  return IANAZone.isValidZone(zone);
}

export function isValidCalendarDate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && DateTime.fromISO(date, { zone: 'UTC' }).isValid;
}

export function exceptionsKnowledgeOf(confirmedThrough: string | null): ExceptionsKnowledge {
  return confirmedThrough
    ? { status: 'CONFIRMED_THROUGH', confirmedThrough }
    : { status: 'NOT_PROVIDED', confirmedThrough: null };
}

export function weekdayName(isoWeekday: number): Weekday {
  return WEEKDAYS[isoWeekday - 1];
}

export function evaluateDate(input: EvaluateDateInput): DateEvaluation {
  const { rule, exceptionsConfirmedThrough } = input;
  const exceptionsKnowledge = exceptionsKnowledgeOf(exceptionsConfirmedThrough);

  if (!rule.timezone) {
    return { computable: false, notComputableReason: 'SCHEDULE_TIMEZONE_UNKNOWN', exceptionsKnowledge, requestedDate: null, nextCandidateOccurrences: [] };
  }
  if (!rule.localStartTime) {
    return { computable: false, notComputableReason: 'LOCAL_START_TIME_UNKNOWN', exceptionsKnowledge, requestedDate: null, nextCandidateOccurrences: [] };
  }
  if (!isValidIanaZone(rule.timezone)) throw new ScheduleEvaluationError(`Invalid schedule timezone: ${rule.timezone}`);
  if (input.viewerTimezone && !isValidIanaZone(input.viewerTimezone)) {
    throw new ScheduleEvaluationError(`Invalid timezone: ${input.viewerTimezone}`);
  }
  if (input.requestedDate && !isValidCalendarDate(input.requestedDate)) {
    throw new ScheduleEvaluationError(`Invalid date: ${input.requestedDate}`);
  }

  const scheduleZone = rule.timezone;
  const refZone = input.viewerTimezone ?? scheduleZone;
  const zones = uniq([scheduleZone, ...(input.viewerTimezone ? [input.viewerTimezone] : []), ...input.displayTimezones]);

  const windowStart = input.requestedDate
    ? DateTime.fromISO(input.requestedDate, { zone: refZone }).startOf('day')
    : DateTime.fromJSDate(input.now, { zone: refZone });

  const ctx: BuildContext = { rule: { ...rule, timezone: scheduleZone, localStartTime: rule.localStartTime }, zones, exceptionsConfirmedThrough };

  // Enough regular slots to fill `count` even if some are cancelled or moved away.
  const slotCount = input.count + input.exceptions.length + 2;
  const slots = regularSlots(ctx.rule, windowStart.minus({ days: 1 }), slotCount);
  const events = applyExceptions(slots, input.exceptions, ctx)
    .filter((e) => e.start >= windowStart)
    .sort((a, b) => a.start.toMillis() - b.start.toMillis());

  const nextCandidateOccurrences: Occurrence[] = [];
  let active = 0;
  for (const e of events) {
    if (active >= input.count) break;
    nextCandidateOccurrences.push(e.occurrence);
    if (e.occurrence.status !== 'CANCELLED') active++;
  }

  let requestedDate: RequestedDateResult | null = null;
  if (input.requestedDate) {
    const date = input.requestedDate;
    const onDate = (dt: DateTime) => dt.setZone(refZone).toISODate() === date;
    const matchesRecurrence = slots.some(onDate);
    const occurrencesOnDate = events.filter((e) => onDate(e.start)).map((e) => e.occurrence);
    requestedDate = {
      date,
      interpretedInTimezone: refZone,
      timezoneSource: input.viewerTimezone ? 'REQUEST_TZ_PARAM' : 'SCHEDULE_CANONICAL_TIMEZONE',
      weekday: weekdayName(windowStart.weekday),
      matchesRecurrence,
      occurrencesOnDate,
      note: requestedDateNote(matchesRecurrence, occurrencesOnDate, ctx.rule),
    };
  }

  return { computable: true, referenceTimezone: refZone, exceptionsKnowledge, requestedDate, nextCandidateOccurrences };
}

// ---------------------------------------------------------------------------

interface BuildContext {
  rule: RecurrenceRule & { timezone: string; localStartTime: string };
  zones: string[];
  exceptionsConfirmedThrough: string | null;
}

interface Event {
  start: DateTime;
  occurrence: Occurrence;
}

function parseTime(t: string): { hour: number; minute: number } {
  const [h, m] = t.split(':').map(Number);
  return { hour: h, minute: m };
}

function atLocal(date: string, time: string, zone: string): DateTime {
  const d = DateTime.fromISO(date, { zone });
  return d.set({ ...parseTime(time), second: 0, millisecond: 0 });
}

/** Regular weekly slots (schedule zone), starting on or after `from`'s local date. */
function regularSlots(rule: BuildContext['rule'], from: DateTime, count: number): DateTime[] {
  let day = from.setZone(rule.timezone).startOf('day');
  day = day.plus({ days: (rule.isoWeekday - day.weekday + 7) % 7 });
  const slots: DateTime[] = [];
  for (let i = 0; i < count; i++) {
    slots.push(atLocal(day.plus({ weeks: i }).toISODate()!, rule.localStartTime, rule.timezone));
  }
  return slots;
}

function applyExceptions(slots: DateTime[], exceptions: ScheduleExceptionInput[], ctx: BuildContext): Event[] {
  const byOriginalDate = new Map(exceptions.filter((e) => e.originalDate).map((e) => [e.originalDate!, e]));
  const events: Event[] = [];

  for (const slot of slots) {
    const localDate = slot.toISODate()!;
    const exc = byOriginalDate.get(localDate);
    if (!exc) {
      const confirmed = ctx.exceptionsConfirmedThrough !== null && localDate <= ctx.exceptionsConfirmedThrough;
      events.push(
        makeEvent(slot, ctx, {
          status: confirmed ? 'SCHEDULED_CONFIRMED' : 'CANDIDATE_UNCONFIRMED',
          statusNote: confirmed
            ? `Matches the recurring schedule; exception data is confirmed through ${ctx.exceptionsConfirmedThrough} and none is recorded for this date.`
            : NOTE_CANDIDATE_UNCONFIRMED,
          originalDate: null,
          exception: null,
        }),
      );
    } else if (exc.type === 'CANCELLED') {
      events.push(
        makeEvent(slot, ctx, {
          status: 'CANCELLED',
          statusNote: `A stored exception cancels this session (exception verification: ${exc.verificationStatus}).`,
          originalDate: null,
          exception: exceptionSummary(exc),
        }),
      );
    } else if (exc.type === 'RESCHEDULED') {
      const moved = atLocal(exc.replacementDate!, exc.replacementStartTime!, ctx.rule.timezone);
      events.push(
        makeEvent(moved, ctx, {
          status: 'RESCHEDULED',
          statusNote: `Moved from ${localDate} by a stored exception (exception verification: ${exc.verificationStatus}).`,
          originalDate: localDate,
          exception: exceptionSummary(exc),
        }),
      );
    }
  }

  for (const exc of exceptions.filter((e) => e.type === 'ADDITIONAL')) {
    const start = atLocal(exc.replacementDate!, exc.replacementStartTime!, ctx.rule.timezone);
    events.push(
      makeEvent(start, ctx, {
        status: 'ADDITIONAL',
        statusNote: `Additional session from a stored exception (exception verification: ${exc.verificationStatus}).`,
        originalDate: null,
        exception: exceptionSummary(exc),
      }),
    );
  }
  return events;
}

function makeEvent(
  start: DateTime,
  ctx: BuildContext,
  rest: Pick<Occurrence, 'status' | 'statusNote' | 'originalDate' | 'exception'>,
): Event {
  const end = start.plus({ minutes: ctx.rule.durationMinutes });
  const localTimes: Record<string, ZonedTime> = {};
  for (const zone of ctx.zones) localTimes[zone] = zoned(start, zone);
  return {
    start,
    occurrence: {
      ...rest,
      scheduleLocalDate: start.setZone(ctx.rule.timezone).toISODate()!,
      startsAtUtc: start.toUTC().toISO({ suppressMilliseconds: true })!,
      endsAtUtc: end.toUTC().toISO({ suppressMilliseconds: true })!,
      localTimes,
    },
  };
}

function zoned(dt: DateTime, zone: string): ZonedTime {
  const z = dt.setZone(zone);
  return {
    localDate: z.toISODate()!,
    localTime: z.toFormat('HH:mm'),
    weekday: weekdayName(z.weekday),
    abbreviation: abbreviation(z),
    utcOffset: z.toFormat('ZZ'),
  };
}

/** Best-effort human abbreviation (PST, BST, CET...). utcOffset is the authoritative value. */
function abbreviation(dt: DateTime): string {
  const isGeneric = (s: string | null) => !s || /^GMT[+-]/.test(s);
  const us = dt.setLocale('en-US').offsetNameShort;
  if (!isGeneric(us)) return us!;
  const gb = dt.setLocale('en-GB').offsetNameShort;
  if (!isGeneric(gb)) return gb!;
  return us ?? dt.toFormat('ZZ');
}

function exceptionSummary(e: ScheduleExceptionInput): Occurrence['exception'] {
  return { type: e.type, reason: e.reason, verificationStatus: e.verificationStatus };
}

function requestedDateNote(matches: boolean, onDate: Occurrence[], rule: BuildContext['rule']): string {
  const ruleText = `weekly on ${weekdayName(rule.isoWeekday)} at ${rule.localStartTime.slice(0, 5)} ${rule.timezone}`;
  if (!matches) {
    const extra = onDate.find((o) => o.status === 'ADDITIONAL' || o.status === 'RESCHEDULED');
    return extra
      ? `This date does not match the recurring schedule (${ruleText}), but a stored ${extra.status} session falls on it.`
      : `This date does not match the recurring schedule (${ruleText}).`;
  }
  const regular = onDate.find((o) => o.status !== 'ADDITIONAL');
  if (!regular) return `This date matches the recurring schedule (${ruleText}), but a stored exception moves the session away from it.`;
  return regular.statusNote;
}

function uniq<T>(xs: T[]): T[] {
  return [...new Set(xs)];
}
