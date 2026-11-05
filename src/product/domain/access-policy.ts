import type { AccessEndRule, AccessStartRule } from '../../common/enums';
import type { Provenance } from '../../common/provenance/provenance';

export interface AccessPolicyInput {
  entitlementDurationMonths: number | null;
  durationProvenance: Provenance;
  startRule: AccessStartRule;
  startRuleProvenance: Provenance;
  endRule: AccessEndRule;
  endRuleProvenance: Provenance;
}

export type AccessPolicyCompleteness = 'COMPLETE' | 'PARTIAL' | 'NONE';

export type AccessWindowUnavailableReason =
  | 'DURATION_UNCONFIRMED'
  | 'START_RULE_UNKNOWN'
  | 'END_RULE_UNKNOWN'
  | 'REQUIRES_PURCHASE_CONTEXT';

export interface AccessPolicySummary {
  completeness: AccessPolicyCompleteness;
  /** Always null in this prototype: access start/end dates are never calculated. */
  computedAccessWindow: null;
  computedAccessWindowUnavailableReasons: AccessWindowUnavailableReason[];
}

/**
 * Summarises partial verification. A confirmed duration stays confirmed even
 * when the start/end rules are unknown, and no access dates are invented.
 */
export function summarizeAccessPolicy(p: AccessPolicyInput): AccessPolicySummary {
  const durationKnown = p.entitlementDurationMonths !== null && p.durationProvenance.verificationStatus === 'CONFIRMED';
  const startKnown = p.startRule !== 'UNKNOWN' && p.startRuleProvenance.verificationStatus === 'CONFIRMED';
  const endKnown = p.endRule !== 'UNKNOWN' && p.endRuleProvenance.verificationStatus === 'CONFIRMED';

  const known = [durationKnown, startKnown, endKnown].filter(Boolean).length;
  const completeness: AccessPolicyCompleteness = known === 3 ? 'COMPLETE' : known === 0 ? 'NONE' : 'PARTIAL';

  const reasons: AccessWindowUnavailableReason[] = [];
  if (!durationKnown) reasons.push('DURATION_UNCONFIRMED');
  if (!startKnown) reasons.push('START_RULE_UNKNOWN');
  if (!endKnown) reasons.push('END_RULE_UNKNOWN');
  // Even with complete rules, dates depend on a specific purchase/attendance.
  reasons.push('REQUIRES_PURCHASE_CONTEXT');

  return { completeness, computedAccessWindow: null, computedAccessWindowUnavailableReasons: reasons };
}
