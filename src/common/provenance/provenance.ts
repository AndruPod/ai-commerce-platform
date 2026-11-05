import type { SourceType, VerificationStatus } from '../enums';

export interface Provenance {
  sourceType: SourceType | null;
  sourceRef: string | null;
  verificationStatus: VerificationStatus;
  verifiedAt: string | null;
}

/** A single important value together with where it came from. */
export interface Fact<T> {
  value: T | null;
  provenance: Provenance;
}

/**
 * A value computed by this system. Never stored, never a published business
 * fact, and only emitted inside data-quality evidence.
 */
export interface Derived<T> {
  value: T;
  sourceType: 'DERIVED';
  derivedFrom: string[];
  isPublishedFact: false;
}

export function derived<T>(value: T, derivedFrom: string[]): Derived<T> {
  return { value, sourceType: 'DERIVED', derivedFrom, isPublishedFact: false };
}

/** Shape of one provenance column group as Drizzle returns it. */
export interface ProvenanceColumns {
  sourceType: SourceType | null;
  sourceRef: string | null;
  verificationStatus: VerificationStatus;
  verifiedAt: Date | null;
}

export function toProvenance(cols: ProvenanceColumns): Provenance {
  return {
    sourceType: cols.sourceType,
    sourceRef: cols.sourceRef,
    verificationStatus: cols.verificationStatus,
    verifiedAt: cols.verifiedAt ? cols.verifiedAt.toISOString() : null,
  };
}

/**
 * Reads a prefixed provenance group (e.g. prefix 'tz' -> tzSourceType,
 * tzSourceRef, tzVerificationStatus, tzVerifiedAt) from a row.
 */
export function pickProvenance<P extends string>(
  row: Record<`${P}SourceType` | `${P}SourceRef` | `${P}VerificationStatus` | `${P}VerifiedAt`, unknown>,
  prefix: P,
): Provenance {
  const r = row as Record<string, unknown>;
  return toProvenance({
    sourceType: r[`${prefix}SourceType`] as SourceType | null,
    sourceRef: r[`${prefix}SourceRef`] as string | null,
    verificationStatus: r[`${prefix}VerificationStatus`] as VerificationStatus,
    verifiedAt: r[`${prefix}VerifiedAt`] as Date | null,
  });
}

export function fact<T>(value: T | null, provenance: Provenance): Fact<T> {
  return { value, provenance };
}
