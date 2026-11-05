import { sql } from 'drizzle-orm';
import { check, date, integer, pgTable, smallint, text, time, uuid } from 'drizzle-orm/pg-core';
import { products } from './product';
import { provenanceColumns, recurrenceFrequencyEnum, scheduleExceptionTypeEnum, timestamps } from './enums';

const tz = () => provenanceColumns('tz_');
const exc = () => provenanceColumns('exceptions_');

/**
 * One canonical recurring schedule per product. The program is ongoing, so
 * there is deliberately no series start/end date. Promotional landing-page
 * dates must never be stored here.
 */
export const schedules = pgTable(
  'schedules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .notNull()
      .unique()
      .references(() => products.id, { onDelete: 'cascade' }),
    frequency: recurrenceFrequencyEnum('frequency').notNull(),
    /** ISO weekday: 1 = Monday ... 7 = Sunday. */
    isoWeekday: smallint('iso_weekday').notNull(),
    /** Local wall-clock start time in `timezone`. Null = unknown. */
    localStartTime: time('local_start_time'),
    durationMinutes: integer('duration_minutes').notNull(),
    /** Canonical IANA timezone. Null = unknown. Has its own provenance (tz_*). */
    timezone: text('timezone'),
    tzSourceType: tz().sourceType,
    tzSourceRef: tz().sourceRef,
    tzVerificationStatus: tz().verificationStatus,
    tzVerifiedAt: tz().verifiedAt,
    /** Original human-readable schedule strings, kept as evidence (not used for conversion). */
    publishedTimeLabels: text('published_time_labels').array().notNull().default(sql`'{}'::text[]`),
    /**
     * Last date for which the exception list is known to be complete.
     * Null = no exception coverage has been provided: an empty exception list
     * then means "none provided", not "none exist".
     */
    exceptionsConfirmedThrough: date('exceptions_confirmed_through', { mode: 'string' }),
    exceptionsSourceType: exc().sourceType,
    exceptionsSourceRef: exc().sourceRef,
    exceptionsVerificationStatus: exc().verificationStatus,
    exceptionsVerifiedAt: exc().verifiedAt,
    ...provenanceColumns(),
    ...timestamps(),
  },
  (t) => [
    check('schedules_iso_weekday_range', sql`${t.isoWeekday} BETWEEN 1 AND 7`),
    check('schedules_duration_positive', sql`${t.durationMinutes} > 0`),
  ],
);

/** Only explicitly provided exceptions are stored. Never generate holidays or breaks. */
export const scheduleExceptions = pgTable(
  'schedule_exceptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    scheduleId: uuid('schedule_id')
      .notNull()
      .references(() => schedules.id, { onDelete: 'cascade' }),
    type: scheduleExceptionTypeEnum('type').notNull(),
    /** Local date (schedule timezone) of the regular occurrence affected. Null for ADDITIONAL sessions. */
    originalDate: date('original_date', { mode: 'string' }),
    replacementDate: date('replacement_date', { mode: 'string' }),
    replacementStartTime: time('replacement_start_time'),
    reason: text('reason'),
    ...provenanceColumns(),
  },
  (t) => [
    check(
      'schedule_exceptions_shape',
      sql`(${t.type} = 'CANCELLED' AND ${t.originalDate} IS NOT NULL AND ${t.replacementDate} IS NULL)
       OR (${t.type} = 'RESCHEDULED' AND ${t.originalDate} IS NOT NULL AND ${t.replacementDate} IS NOT NULL AND ${t.replacementStartTime} IS NOT NULL)
       OR (${t.type} = 'ADDITIONAL' AND ${t.originalDate} IS NULL AND ${t.replacementDate} IS NOT NULL AND ${t.replacementStartTime} IS NOT NULL)`,
    ),
  ],
);
