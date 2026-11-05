import type { ObservedBillingInterval, PricingBasis, SourceType } from '../../common/enums';
import { derived, Derived } from '../../common/provenance/provenance';
import { checkPerClassPriceClaim, formatMinor, parsePerClassClaim, PerClassVerdict } from '../../product/domain/price-claim';

export interface EvidenceContext {
  offer: { amountMinor: number | null; currency: string | null; pricingBasis?: PricingBasis; sourceType?: SourceType | null } | null;
  program: { includedClassCount: number } | null;
  /** What an external checkout displayed (source evidence, not derived). */
  checkoutObservation?: { amountMinor: number; currency: string; billing: ObservedBillingInterval | null; observedAt: string | null } | null;
}

export interface PerClassEvidence {
  derivedPricePerIncludedClass: Derived<{ amountMinor: number; currency: string; display: string; approximate: true }>;
  claimComparison: Derived<{ verdict: PerClassVerdict; claimedAmountMinor: number; reason: string }>;
}

/**
 * Authoritative offer vs observed checkout. Both amounts are source facts with
 * their own source types; only the comparison is DERIVED.
 */
export interface CheckoutPriceEvidence {
  authoritativeOffer: { amountMinor: number; currency: string; display: string; pricingBasis: PricingBasis | null; sourceType: SourceType | null };
  observedCheckout: { amountMinor: number; currency: string; display: string; billing: ObservedBillingInterval | null; observedAt: string | null; sourceType: 'MANUAL_CHECKOUT_VERIFICATION' };
  comparison: Derived<{ amountsMatch: boolean; sameCurrency: boolean; differenceMinor: number | null; resolution: 'UNRESOLVED' }>;
}

export type IssueEvidence = PerClassEvidence | CheckoutPriceEvidence | null;

/**
 * Builds read-time evidence for an issue. All values are DERIVED and live only
 * inside data-quality responses; they are never written back as commerce data.
 */
export function buildIssueEvidence(issue: { fieldPath: string; rawClaim: string | null }, ctx: EvidenceContext): IssueEvidence {
  if (issue.fieldPath === 'checkout.price') return checkoutPriceEvidence(ctx);
  if (issue.fieldPath !== 'offer.pricePerClass' || !issue.rawClaim) return null;
  const { offer, program } = ctx;
  if (!offer?.amountMinor || !offer.currency || !program) return null;
  const claim = parsePerClassClaim(issue.rawClaim);
  if (!claim) return null;

  const result = checkPerClassPriceClaim({
    packageAmountMinor: offer.amountMinor,
    currency: offer.currency,
    includedClassCount: program.includedClassCount,
    claim,
  });
  const from = ['offer.amountMinor', 'program.includedClassCount'];
  return {
    derivedPricePerIncludedClass: derived(
      {
        amountMinor: result.derivedPerClassMinor,
        currency: offer.currency,
        display: formatMinor(result.derivedPerClassMinor, offer.currency),
        approximate: true,
      },
      from,
    ),
    claimComparison: derived({ verdict: result.verdict, claimedAmountMinor: result.claimedAmountMinor, reason: result.reason }, [
      ...from,
      'dataQualityIssue.rawClaim',
    ]),
  };
}

function checkoutPriceEvidence({ offer, checkoutObservation: obs }: EvidenceContext): CheckoutPriceEvidence | null {
  if (!offer?.amountMinor || !offer.currency || !obs) return null;
  const sameCurrency = offer.currency === obs.currency;
  return {
    authoritativeOffer: {
      amountMinor: offer.amountMinor,
      currency: offer.currency,
      display: formatMinor(offer.amountMinor, offer.currency),
      pricingBasis: offer.pricingBasis ?? null,
      sourceType: offer.sourceType ?? null,
    },
    observedCheckout: {
      amountMinor: obs.amountMinor,
      currency: obs.currency,
      display: formatMinor(obs.amountMinor, obs.currency),
      billing: obs.billing,
      observedAt: obs.observedAt,
      sourceType: 'MANUAL_CHECKOUT_VERIFICATION',
    },
    // Only states that the two differ; it does not decide which one is correct.
    comparison: derived(
      {
        amountsMatch: sameCurrency && offer.amountMinor === obs.amountMinor,
        sameCurrency,
        differenceMinor: sameCurrency ? offer.amountMinor - obs.amountMinor : null,
        resolution: 'UNRESOLVED',
      },
      ['offer.amountMinor', 'checkout.observedAmountMinor'],
    ),
  };
}
