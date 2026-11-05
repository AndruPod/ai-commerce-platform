/**
 * Presentation-only: IANA zones used to render each occurrence alongside the
 * schedule's canonical timezone. Chosen to mirror the published labels
 * (EDT -> New York, UK -> London, CEST -> Berlin as a representative CET zone).
 * These are not business facts; conversions are always computed per date.
 */
export const REFERENCE_DISPLAY_TIMEZONES = ['America/New_York', 'Europe/London', 'Europe/Berlin', 'UTC'];
