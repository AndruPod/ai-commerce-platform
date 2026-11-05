import type { EnrollmentStatus } from '../../common/enums';
import type { Provenance } from '../../common/provenance/provenance';

/**
 * Pure enrollment reasoning. Its inputs are deliberately limited to configured
 * availability windows: it takes no schedule, checkout or promotional-date
 * input, so none of those can influence the result.
 */

export interface AvailabilityWindow {
  status: EnrollmentStatus;
  /** Inclusive "YYYY-MM-DD"; null = open-ended. */
  effectiveFrom: string | null;
  effectiveUntil: string | null;
  notes: string | null;
  provenance: Provenance;
  configuredAt: string;
}

/**
 * - CURRENT_CONFIGURATION: date is today or later; the answer reflects the
 *   configuration as it stands now (no future change is configured).
 * - PAST_DATE: date is before today; the answer reflects currently stored
 *   windows, which are not a full history.
 * - NO_CONFIGURATION: no window covers the date, so the status is UNKNOWN.
 */
export type AvailabilityBasis = 'CURRENT_CONFIGURATION' | 'PAST_DATE' | 'NO_CONFIGURATION';

export interface AvailabilityResolution {
  status: EnrollmentStatus;
  evaluatedForDate: string;
  basis: AvailabilityBasis;
  window: AvailabilityWindow | null;
}

export function windowCovers(w: AvailabilityWindow, date: string): boolean {
  return (w.effectiveFrom === null || w.effectiveFrom <= date) && (w.effectiveUntil === null || date <= w.effectiveUntil);
}

export function resolveAvailability(windows: AvailabilityWindow[], date: string, today: string): AvailabilityResolution {
  const covering = windows
    .filter((w) => windowCovers(w, date))
    // Most specific first: the latest start date wins, then the most recently configured.
    .sort(
      (a, b) =>
        (b.effectiveFrom ?? '').localeCompare(a.effectiveFrom ?? '') || b.configuredAt.localeCompare(a.configuredAt),
    );

  const window = covering[0] ?? null;
  if (!window) return { status: 'UNKNOWN', evaluatedForDate: date, basis: 'NO_CONFIGURATION', window: null };
  return {
    status: window.status,
    evaluatedForDate: date,
    basis: date < today ? 'PAST_DATE' : 'CURRENT_CONFIGURATION',
    window,
  };
}
