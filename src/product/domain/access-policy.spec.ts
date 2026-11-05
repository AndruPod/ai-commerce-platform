import type { Provenance } from '../../common/provenance/provenance';
import { AccessPolicyInput, summarizeAccessPolicy } from './access-policy';

const CONFIRMED: Provenance = { sourceType: 'ASSIGNMENT_BRIEF', sourceRef: 'Assignment brief', verificationStatus: 'CONFIRMED', verifiedAt: '2026-10-03T00:00:00.000Z' };
const UNKNOWN: Provenance = { sourceType: null, sourceRef: null, verificationStatus: 'UNKNOWN', verifiedAt: null };

const VSA: AccessPolicyInput = {
  entitlementDurationMonths: 12,
  durationProvenance: CONFIRMED,
  startRule: 'UNKNOWN',
  startRuleProvenance: UNKNOWN,
  endRule: 'UNKNOWN',
  endRuleProvenance: UNKNOWN,
};

describe('summarizeAccessPolicy', () => {
  it('confirmed 12-month duration with unknown boundaries is PARTIAL and computes no access window', () => {
    expect(summarizeAccessPolicy(VSA)).toEqual({
      completeness: 'PARTIAL',
      computedAccessWindow: null,
      computedAccessWindowUnavailableReasons: ['START_RULE_UNKNOWN', 'END_RULE_UNKNOWN', 'REQUIRES_PURCHASE_CONTEXT'],
    });
  });

  it('does not downgrade the confirmed duration because boundaries are unknown', () => {
    expect(summarizeAccessPolicy(VSA).computedAccessWindowUnavailableReasons).not.toContain('DURATION_UNCONFIRMED');
  });

  it('is COMPLETE only when all three parts are confirmed, and still computes no dates', () => {
    const r = summarizeAccessPolicy({
      ...VSA,
      startRule: 'ON_PURCHASE',
      startRuleProvenance: CONFIRMED,
      endRule: 'DURATION_AFTER_START',
      endRuleProvenance: CONFIRMED,
    });
    expect(r).toEqual({ completeness: 'COMPLETE', computedAccessWindow: null, computedAccessWindowUnavailableReasons: ['REQUIRES_PURCHASE_CONTEXT'] });
  });

  it('a rule value that is set but UNCONFIRMED does not count as known', () => {
    const r = summarizeAccessPolicy({ ...VSA, startRule: 'ON_PURCHASE', startRuleProvenance: { ...CONFIRMED, verificationStatus: 'UNCONFIRMED' } });
    expect(r.completeness).toBe('PARTIAL');
    expect(r.computedAccessWindowUnavailableReasons).toContain('START_RULE_UNKNOWN');
  });

  it('is NONE when nothing is confirmed', () => {
    expect(summarizeAccessPolicy({ ...VSA, entitlementDurationMonths: null, durationProvenance: UNKNOWN }).completeness).toBe('NONE');
  });
});
