/**
 * Checks a free-text per-class price claim (e.g. "$3/class") against the
 * package price and included class count. The per-class figure it computes is
 * a derived value: it is evidence for a data-quality issue, never a price.
 */

export interface ParsedPerClassClaim {
  amountMinor: number;
  currencySymbol: string | null;
}

export type PerClassVerdict = 'CONSISTENT' | 'CONFLICTING' | 'NOT_COMPARABLE';

export interface PerClassCheckInput {
  packageAmountMinor: number;
  currency: string;
  includedClassCount: number;
  claim: ParsedPerClassClaim;
  /** Allowed difference in minor units between claim and the exact per-class amount. */
  toleranceMinor?: number;
}

export interface PerClassCheckResult {
  verdict: PerClassVerdict;
  /** Package price / class count, rounded to the nearest minor unit. */
  derivedPerClassMinor: number;
  claimedAmountMinor: number;
  reason: string;
}

const SYMBOL_CURRENCIES: Record<string, string> = { $: 'USD', '€': 'EUR', '£': 'GBP' };

export function parsePerClassClaim(raw: string): ParsedPerClassClaim | null {
  const m = /^\s*([$€£])?\s*(\d+(?:\.\d{1,2})?)\s*(?:\/|per)\s*class\s*$/i.exec(raw);
  if (!m) return null;
  return { amountMinor: Math.round(Number(m[2]) * 100), currencySymbol: m[1] ?? null };
}

export function checkPerClassPriceClaim(input: PerClassCheckInput): PerClassCheckResult {
  const { packageAmountMinor, currency, includedClassCount, claim } = input;
  if (includedClassCount <= 0) throw new Error('includedClassCount must be positive');
  const exact = packageAmountMinor / includedClassCount;
  const derivedPerClassMinor = Math.round(exact);
  const base = { derivedPerClassMinor, claimedAmountMinor: claim.amountMinor };

  const claimCurrency = claim.currencySymbol ? SYMBOL_CURRENCIES[claim.currencySymbol] : null;
  if (claimCurrency && claimCurrency !== currency) {
    return { ...base, verdict: 'NOT_COMPARABLE', reason: `Claim currency (${claimCurrency}) differs from offer currency (${currency}).` };
  }

  const tolerance = input.toleranceMinor ?? 1;
  const consistent = Math.abs(claim.amountMinor - exact) <= tolerance;
  return {
    ...base,
    verdict: consistent ? 'CONSISTENT' : 'CONFLICTING',
    reason: consistent
      ? 'Claim matches package price divided by included class count.'
      : 'Claim does not match package price divided by included class count.',
  };
}

export function formatMinor(amountMinor: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amountMinor / 100);
}
