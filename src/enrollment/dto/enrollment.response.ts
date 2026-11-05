import type { EnrollmentStatus } from '../../common/enums';
import type { Provenance } from '../../common/provenance/provenance';
import type { AvailabilityBasis } from '../domain/resolve-availability';

export interface EnrollmentViewDto {
  status: EnrollmentStatus;
  evaluatedForDate: string;
  evaluatedAt: string;
  basis: AvailabilityBasis;
  basisNote: string;
  window: {
    kind: 'OPEN_ENDED' | 'BOUNDED' | 'STARTS_ON' | 'ENDS_ON';
    effectiveFrom: string | null;
    effectiveUntil: string | null;
    notes: string | null;
    configuredAt: string;
  } | null;
  provenance: Provenance | null;
  /** Concepts this status is NOT derived from. */
  independentOf: string[];
}

export interface EnrollmentResponseDto extends EnrollmentViewDto {
  product: { slug: string; name: string };
}
