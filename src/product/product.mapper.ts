import { fact, pickProvenance, toProvenance } from '../common/provenance/provenance';
import type { BusinessRefDto } from '../business/dto/business.response';
import { summarizeAccessPolicy } from './domain/access-policy';
import { formatMinor } from './domain/price-claim';
import type { AccessPolicyDto, OfferDto, ProductDetailDto, ProductSummaryDto } from './dto/product.response';
import type { AccessPolicyRow, AudienceRow, OfferRow, ProductWithBusiness, RequirementRow } from './product.repository';

// Explicit row -> DTO mapping so raw Drizzle rows never leave the service layer.

export function toProductSummary(row: ProductWithBusiness, aliases: string[], audience: AudienceRow[]): ProductSummaryDto {
  const { product, business, program } = row;
  const business_: BusinessRefDto = { slug: business.slug, canonicalName: business.canonicalName, aliases };
  return {
    slug: product.slug,
    name: product.name,
    productType: product.productType,
    deliveryMode: product.deliveryMode,
    discipline: product.discipline,
    status: product.status,
    business: business_,
    durationMonths: program?.durationMonths ?? null,
    audienceLevels: audience.map((a) => a.level).sort(),
  };
}

export function toOffer(o: OfferRow): OfferDto {
  return {
    label: o.label,
    price:
      o.amountMinor !== null && o.currency !== null
        ? { amountMinor: o.amountMinor, currency: o.currency, display: formatMinor(o.amountMinor, o.currency) }
        : null,
    pricingBasis: o.pricingBasis,
    paymentSchedule: o.paymentSchedule,
    paymentTerms: o.paymentTerms,
    provenance: toProvenance(o),
  };
}

export function toAccessPolicy(a: AccessPolicyRow): AccessPolicyDto {
  const durationProvenance = pickProvenance(a, 'duration');
  const startRuleProvenance = pickProvenance(a, 'startRule');
  const endRuleProvenance = pickProvenance(a, 'endRule');
  const summary = summarizeAccessPolicy({
    entitlementDurationMonths: a.entitlementDurationMonths,
    durationProvenance,
    startRule: a.startRule,
    startRuleProvenance,
    endRule: a.endRule,
    endRuleProvenance,
  });
  return {
    entitlementDuration: fact(a.entitlementDurationMonths !== null ? { months: a.entitlementDurationMonths } : null, durationProvenance),
    startRule: fact(a.startRule, startRuleProvenance),
    endRule: fact(a.endRule, endRuleProvenance),
    ...summary,
  };
}

export function toRequirements(rows: RequirementRow[]): ProductDetailDto['requirements'] {
  return rows.length === 0
    ? {
        knowledge: 'NOT_PROVIDED',
        note: 'No participation or equipment requirements have been provided to this prototype. This does not mean there are none.',
        items: [],
      }
    : {
        knowledge: 'PROVIDED',
        note: 'Only the listed requirements have been provided.',
        items: rows.map((r) => ({ category: r.category, description: r.description, provenance: toProvenance(r) })),
      };
}
