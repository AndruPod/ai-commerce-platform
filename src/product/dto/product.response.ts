import type {
  AccessEndRule,
  AccessStartRule,
  CoachRole,
  DeliveryMode,
  Discipline,
  ExperienceLevel,
  PaymentSchedule,
  PricingBasis,
  ProductStatus,
  ProductType,
  RequirementCategory,
} from '../../common/enums';
import type { Fact, Provenance } from '../../common/provenance/provenance';
import type { BusinessRefDto } from '../../business/dto/business.response';
import type { AccessPolicyCompleteness, AccessWindowUnavailableReason } from '../domain/access-policy';

export interface ProductSummaryDto {
  slug: string;
  name: string;
  productType: ProductType;
  deliveryMode: DeliveryMode;
  discipline: Discipline;
  status: ProductStatus;
  business: BusinessRefDto;
  durationMonths: number | null;
  audienceLevels: ExperienceLevel[];
}

export interface ProductListResponseDto {
  items: ProductSummaryDto[];
  businessResolution: { requested: string; matchedBusinessSlug: string | null; matchedBy: string | null; matchedValue: string | null } | null;
  appliedFilters: Record<string, string | number>;
}

export interface OfferDto {
  label: string;
  price: { amountMinor: number; currency: string; display: string } | null;
  pricingBasis: PricingBasis;
  paymentSchedule: PaymentSchedule;
  paymentTerms: string | null;
  provenance: Provenance;
}

export interface AccessPolicyDto {
  entitlementDuration: Fact<{ months: number }>;
  startRule: Fact<AccessStartRule>;
  endRule: Fact<AccessEndRule>;
  completeness: AccessPolicyCompleteness;
  computedAccessWindow: null;
  computedAccessWindowUnavailableReasons: AccessWindowUnavailableReason[];
}

export interface ProductDetailDto extends ProductSummaryDto {
  description: string | null;
  audience: { level: ExperienceLevel; provenance: Provenance }[];
  offers: OfferDto[];
  program: { durationMonths: number; includedClasses: number; classDurationMinutes: number; provenance: Provenance } | null;
  coaches: { displayName: string; role: CoachRole; provenance: Provenance }[];
  accessPolicy: AccessPolicyDto | null;
  requirements: {
    knowledge: 'NOT_PROVIDED' | 'PROVIDED';
    note: string;
    items: { category: RequirementCategory; description: string; provenance: Provenance }[];
  };
  openDataQualityIssues: number;
  links: Record<string, string>;
}
