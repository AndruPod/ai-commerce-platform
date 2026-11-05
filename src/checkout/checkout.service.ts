import { Injectable } from '@nestjs/common';
import { toProvenance } from '../common/provenance/provenance';
import { formatMinor } from '../product/domain/price-claim';
import { ProductService } from '../product/product.service';
import { CheckoutActionRow, CheckoutRepository } from './checkout.repository';
import { evaluateCheckoutEligibility } from './domain/checkout-eligibility';
import { CheckoutActionDto, CheckoutResponseDto, ObservedCheckoutTermsDto } from './dto/checkout.response';

@Injectable()
export class CheckoutService {
  constructor(
    private readonly repo: CheckoutRepository,
    private readonly products: ProductService,
  ) {}

  async getForSlug(slug: string): Promise<CheckoutResponseDto> {
    const ctx = await this.products.getContextOrThrow(slug);
    const [rows, openBlockingIssues] = await Promise.all([
      this.repo.findByProductId(ctx.product.id),
      this.repo.openBlockingIssues(ctx.product.id),
    ]);
    return {
      product: { slug: ctx.product.slug, name: ctx.product.name },
      actions: rows.map(({ action, offer }) => toCheckoutActionDto(action, offer, openBlockingIssues)),
      note: 'Checkout hands off to the existing external system of record; this API processes no payments. A checkout is offered only when usable; a captured checkout URL is withheld while blocked. Checkout says nothing about whether enrollment is open; use /enrollment for that.',
    };
  }
}

/** Pure mapping (exported for tests). The raw URL leaves this function only when the checkout is usable. */
export function toCheckoutActionDto(
  a: CheckoutActionRow,
  o: { label: string; amountMinor: number | null; currency: string | null } | null,
  openBlockingIssues: Parameters<typeof evaluateCheckoutEligibility>[0]['openBlockingIssues'],
): CheckoutActionDto {
  const { usable, blockingIssues } = evaluateCheckoutEligibility({
    url: a.externalUrl,
    status: a.status,
    verificationStatus: a.verificationStatus,
    openBlockingIssues,
  });
  const urlCaptured = a.externalUrl !== null;
  return {
    type: a.checkoutType,
    provider: a.provider,
    systemOfRecord: a.systemOfRecord,
    status: a.status,
    urlCaptured,
    url: usable ? a.externalUrl : null,
    urlWithheld: urlCaptured && !usable,
    usable,
    blockingIssues,
    verification: toProvenance(a),
    offer: o
      ? { label: o.label, amountMinor: o.amountMinor, currency: o.currency, display: o.amountMinor !== null && o.currency ? formatMinor(o.amountMinor, o.currency) : null }
      : null,
    observedTerms: observedTerms(a),
  };
}

function observedTerms(a: CheckoutActionRow): ObservedCheckoutTermsDto | null {
  if (!a.observedAt) return null;
  return {
    merchant: a.observedMerchant,
    productLabel: a.observedProductLabel,
    amountMinor: a.observedAmountMinor,
    currency: a.observedCurrency,
    display: a.observedAmountMinor !== null && a.observedCurrency ? formatMinor(a.observedAmountMinor, a.observedCurrency) : null,
    billing: a.observedBilling,
    termsText: a.observedTermsText,
    observedAt: a.observedAt,
    isAuthoritativeOffer: false,
  };
}
