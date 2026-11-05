import type { CheckoutStatus, TransactionBlockCode, VerificationStatus } from '../../common/enums';

/**
 * Decides whether an external checkout may be offered as a transaction.
 * A captured URL is necessary but never sufficient: the checkout must be
 * operationally active, its commercial terms must not be marked conflicting,
 * and no OPEN material commerce issue may block it.
 */

export type CheckoutBlockCode = 'URL_NOT_CAPTURED' | 'CHECKOUT_NOT_ACTIVE' | 'CHECKOUT_TERMS_CONFLICTING' | TransactionBlockCode;

export interface CheckoutBlock {
  code: CheckoutBlockCode;
  message: string;
}

export interface CheckoutEligibilityInput {
  url: string | null;
  status: CheckoutStatus;
  verificationStatus: VerificationStatus;
  /** OPEN data-quality issues for the product that carry a blocking code. */
  openBlockingIssues: { code: TransactionBlockCode; message: string }[];
}

export interface CheckoutEligibility {
  usable: boolean;
  blockingIssues: CheckoutBlock[];
}

const STATUS_MESSAGES: Record<Exclude<CheckoutStatus, 'ACTIVE'>, string> = {
  NOT_CAPTURED: 'The checkout URL has not been captured yet.',
  UNVERIFIED: 'The checkout has not been verified.',
  INACTIVE: 'This checkout is inactive.',
};

export function evaluateCheckoutEligibility(input: CheckoutEligibilityInput): CheckoutEligibility {
  const blocks: CheckoutBlock[] = [];

  if (input.url === null && input.status !== 'NOT_CAPTURED') {
    blocks.push({ code: 'URL_NOT_CAPTURED', message: 'No checkout URL has been captured.' });
  }
  if (input.status !== 'ACTIVE') {
    blocks.push({ code: input.status === 'NOT_CAPTURED' ? 'URL_NOT_CAPTURED' : 'CHECKOUT_NOT_ACTIVE', message: STATUS_MESSAGES[input.status] });
  }
  blocks.push(...input.openBlockingIssues);
  if (input.verificationStatus === 'CONFLICTING' && input.openBlockingIssues.length === 0) {
    blocks.push({
      code: 'CHECKOUT_TERMS_CONFLICTING',
      message: "The checkout's commercial terms are marked as conflicting with the product's authoritative offer.",
    });
  }
  return { usable: blocks.length === 0, blockingIssues: blocks };
}
