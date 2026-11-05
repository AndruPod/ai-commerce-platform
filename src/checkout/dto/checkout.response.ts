import type { CheckoutProvider, CheckoutStatus, CheckoutType, ObservedBillingInterval } from '../../common/enums';
import type { Provenance } from '../../common/provenance/provenance';
import type { CheckoutBlock } from '../domain/checkout-eligibility';

export interface ObservedCheckoutTermsDto {
  merchant: string | null;
  productLabel: string | null;
  amountMinor: number | null;
  currency: string | null;
  display: string | null;
  billing: ObservedBillingInterval | null;
  termsText: string[];
  observedAt: string | null;
  /** Always a non-authoritative observation of what the checkout displayed. */
  isAuthoritativeOffer: false;
}

export interface CheckoutActionDto {
  type: CheckoutType;
  provider: CheckoutProvider | null;
  systemOfRecord: string;
  /** Operational state observed at the provider. Not an approval to transact. */
  status: CheckoutStatus;
  urlCaptured: boolean;
  /** Only present when `usable` is true; withheld while the checkout is blocked. */
  url: string | null;
  urlWithheld: boolean;
  usable: boolean;
  blockingIssues: CheckoutBlock[];
  /** How the checkout's commercial terms check out against the authoritative offer. */
  verification: Provenance;
  /** The authoritative product offer this checkout is linked to. */
  offer: { label: string; amountMinor: number | null; currency: string | null; display: string | null } | null;
  observedTerms: ObservedCheckoutTermsDto | null;
}

export interface CheckoutResponseDto {
  product: { slug: string; name: string };
  actions: CheckoutActionDto[];
  note: string;
}
