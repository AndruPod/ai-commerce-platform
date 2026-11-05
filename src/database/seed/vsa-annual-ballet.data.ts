import type {
  AccessEndRule,
  AccessStartRule,
  CheckoutProvider,
  CheckoutStatus,
  CoachRole,
  DataQualityIssueType,
  DeliveryMode,
  Discipline,
  EnrollmentStatus,
  ExperienceLevel,
  ObservedBillingInterval,
  PaymentSchedule,
  PricingBasis,
  ProductStatus,
  ProductType,
  RequirementCategory,
  ScheduleExceptionType,
  SourceType,
  TransactionBlockCode,
  VerificationStatus,
} from '../../common/enums';

/**
 * Business-approved seed data for the VSA 1-Year Online Ballet Club.
 *
 * Everything here came in through the assignment brief, so it is tagged ASSIGNMENT_BRIEF.
 * The landing-page URL is only a reference: nothing has been captured from the page
 * itself yet, so nothing is tagged LANDING_PAGE.
 */

export const LANDING_PAGE_URL = 'https://victoryskating.com/balletgroupprogram';

/** When the brief's facts were recorded into this prototype. */
export const BRIEF_RECORDED_AT = new Date('2026-10-03T00:00:00.000Z');

/** Captured external checkout (manually opened 2026-10-03; screenshot in docs/evidence/checkout/). */
export const CHECKOUT_URL = 'https://buy.stripe.com/fZudR90Q3cxm69k8sTdMM2n';
export const CHECKOUT_OBSERVED_ON = '2026-10-03';
const CHECKOUT_OBSERVED_AT = new Date('2026-10-03T00:00:00.000Z');
// Deliberately URL-free: source references are exposed via the API and must not leak the blocked checkout URL.
const CHECKOUT_REF = `Manual inspection on ${CHECKOUT_OBSERVED_ON} of the Stripe-hosted VSA checkout linked from the program landing page (screenshot: docs/evidence/checkout/)`;

export interface SeedProvenance {
  sourceType: SourceType | null;
  sourceRef: string | null;
  verificationStatus: VerificationStatus;
  verifiedAt: Date | null;
}

const BRIEF = 'Assignment brief';
const BRIEF_PUBLISHED = `Assignment brief: reported as published on ${LANDING_PAGE_URL} (page not yet captured directly)`;

const confirmedFromBrief = (ref: string = BRIEF): SeedProvenance => ({
  sourceType: 'ASSIGNMENT_BRIEF',
  sourceRef: ref,
  verificationStatus: 'CONFIRMED',
  verifiedAt: BRIEF_RECORDED_AT,
});

const UNKNOWN: SeedProvenance = { sourceType: null, sourceRef: null, verificationStatus: 'UNKNOWN', verifiedAt: null };

export interface ScheduleExceptionSeed {
  type: ScheduleExceptionType;
  originalDate: string | null;
  replacementDate: string | null;
  replacementStartTime: string | null;
  reason: string | null;
  provenance: SeedProvenance;
}

export interface RequirementSeed {
  category: RequirementCategory;
  description: string;
  provenance: SeedProvenance;
}

export interface DataQualityIssueSeed {
  fieldPath: string;
  rawClaim: string | null;
  claimSourceType: SourceType | null;
  claimSourceRef: string | null;
  capturedAt?: Date | null;
  issueType: DataQualityIssueType;
  explanation: string;
  status?: 'OPEN' | 'RESOLVED';
  resolvedAt?: Date | null;
  blockingCode?: TransactionBlockCode | null;
}

export const vsaSeed = {
  business: {
    slug: 'victory-skating-academy',
    canonicalName: 'Victory Skating Academy',
    aliases: ['Victory Skating', 'VSA'],
    aliasProvenance: confirmedFromBrief(),
  },
  coach: { displayName: 'Emilia', bio: null as string | null },
  product: {
    slug: '1-year-online-ballet-club',
    name: '1-Year Online Ballet Club',
    productType: 'GROUP_PROGRAM' as ProductType,
    deliveryMode: 'ONLINE_LIVE' as DeliveryMode,
    discipline: 'BALLET' as Discipline,
    description: null as string | null, // exact marketing copy not captured
    status: 'ACTIVE' as ProductStatus,
  },
  audienceLevels: ['BEGINNER', 'RECREATIONAL', 'ADVANCED', 'PROFESSIONAL'] as ExperienceLevel[],
  audienceProvenance: confirmedFromBrief(),
  coachRole: 'LEAD' as CoachRole,
  coachProvenance: confirmedFromBrief(),
  offer: {
    label: 'Annual package',
    amountMinor: 49900,
    currency: 'USD',
    pricingBasis: 'PACKAGE_TOTAL' as PricingBasis,
    // Not inferred: the brief does not say whether $499 is paid once or in installments.
    paymentSchedule: 'UNKNOWN' as PaymentSchedule,
    paymentTerms: null as string | null,
    provenance: confirmedFromBrief(`${BRIEF_PUBLISHED}; published annual package price`),
  },
  program: {
    durationMonths: 12,
    includedClassCount: 48,
    classDurationMinutes: 60,
    provenance: confirmedFromBrief(),
  },
  schedule: {
    frequency: 'WEEKLY' as const,
    isoWeekday: 6, // Saturday
    localStartTime: '11:00',
    durationMinutes: 60,
    provenance: confirmedFromBrief(BRIEF_PUBLISHED),
    timezone: 'America/Los_Angeles',
    timezoneProvenance: {
      sourceType: 'ASSIGNMENT_BRIEF',
      sourceRef:
        'Modelling assumption based on the published "11:00–12:00 PDT" label; VSA has not confirmed a canonical IANA timezone',
      verificationStatus: 'UNCONFIRMED',
      verifiedAt: null,
    } as SeedProvenance,
    publishedTimeLabels: ['11:00–12:00 PDT', '14:00–15:00 EDT', '19:00–20:00 UK', '20:00–21:00 CEST'],
    // No exception coverage provided: the empty list below means "none provided", not "none exist".
    exceptionsConfirmedThrough: null as string | null,
    exceptionsProvenance: UNKNOWN,
  },
  scheduleExceptions: [] as ScheduleExceptionSeed[],
  enrollment: {
    status: 'OPEN' as EnrollmentStatus,
    effectiveFrom: null as string | null,
    effectiveUntil: null as string | null,
    notes: 'Open-ended demo configuration.',
    provenance: {
      sourceType: 'PROTOTYPE_CONFIG',
      sourceRef: 'Demo configuration for technical prototype; not confirmed by VSA',
      verificationStatus: 'UNCONFIRMED',
      verifiedAt: null,
    } as SeedProvenance,
  },
  accessPolicy: {
    entitlementDurationMonths: 12,
    durationProvenance: confirmedFromBrief(),
    startRule: 'UNKNOWN' as AccessStartRule,
    startRuleProvenance: UNKNOWN,
    endRule: 'UNKNOWN' as AccessEndRule,
    endRuleProvenance: UNKNOWN,
  },
  // Deliberately empty: no requirement wording has been captured from the source.
  requirements: [] as RequirementSeed[],
  // Captured and observed live, but its commercial terms conflict with the authoritative offer,
  // so it is NOT usable. The offer above is intentionally left unchanged.
  checkout: {
    checkoutType: 'EXTERNAL_CHECKOUT' as const,
    provider: 'STRIPE' as CheckoutProvider,
    externalUrl: CHECKOUT_URL as string | null,
    status: 'ACTIVE' as CheckoutStatus, // operational: the page loaded at the provider; not an approval
    systemOfRecord: 'Stripe-hosted checkout (external system of record)',
    observedMerchant: 'VSA',
    observedProductLabel: '1-Year Ballet Club (weekly classes)',
    observedAmountMinor: 17900,
    observedCurrency: 'USD',
    observedBilling: 'ANNUAL' as ObservedBillingInterval,
    observedTermsText: [
      'Subscribe to 1-Year Ballet Club (weekly classes).',
      '$179.00 per year',
      'Billed annually',
      'You can cancel at least 48 hours before your next payment date by viewing Subscriptions in your email.',
      'Non-Refundable Payment Terms.',
      'By subscribing, you authorize VSA to charge you according to the terms until you cancel.',
    ],
    observedAt: CHECKOUT_OBSERVED_ON as string | null,
    provenance: {
      sourceType: 'MANUAL_CHECKOUT_VERIFICATION',
      sourceRef: CHECKOUT_REF,
      verificationStatus: 'CONFLICTING',
      verifiedAt: CHECKOUT_OBSERVED_AT,
    } as SeedProvenance,
  },
  dataQualityIssues: [
    {
      fieldPath: 'offer.pricePerClass',
      rawClaim: '$3/class',
      claimSourceType: 'ASSIGNMENT_BRIEF',
      claimSourceRef: `${BRIEF}: reported as displayed on ${LANDING_PAGE_URL}`,
      issueType: 'CONFLICTING',
      explanation:
        'The published annual package price is $499 USD for 48 included classes. Dividing the package price by the included class count gives approximately $10.40, so the "$3/class" claim is inconsistent.',
    },
    {
      fieldPath: 'schedule.timezone',
      rawClaim: '11:00–12:00 PDT / 14:00–15:00 EDT / 19:00–20:00 UK / 20:00–21:00 CEST',
      claimSourceType: 'ASSIGNMENT_BRIEF',
      claimSourceRef: BRIEF_PUBLISHED,
      issueType: 'AMBIGUOUS',
      explanation:
        'The source lists the schedule with human-readable timezone labels and does not state a canonical IANA timezone or which timezone stays fixed across daylight-saving transitions. America/Los_Angeles is used as an unconfirmed modelling assumption.',
    },
    {
      fieldPath: 'program.includedClassCount',
      rawClaim: '48 live group classes; weekly on Saturdays',
      claimSourceType: 'ASSIGNMENT_BRIEF',
      claimSourceRef: BRIEF,
      issueType: 'AMBIGUOUS',
      explanation:
        'The program includes 48 classes and recurs weekly on Saturdays. A year has more Saturdays than included classes, but the specific non-class Saturdays or breaks have not been provided. This is not an error; the missing detail is simply unknown.',
    },
    {
      fieldPath: 'checkout.externalUrl',
      rawClaim: null,
      claimSourceType: null,
      claimSourceRef: null,
      issueType: 'MISSING',
      explanation: 'The production checkout URL has not been captured yet. Checkout stays NOT_CAPTURED until it is.',
      // Resolved by the manual checkout capture; capture does not make the checkout usable (see checkout.price).
      status: 'RESOLVED',
      resolvedAt: CHECKOUT_OBSERVED_AT,
    },
    {
      fieldPath: 'requirements',
      rawClaim: null,
      claimSourceType: null,
      claimSourceRef: null,
      issueType: 'MISSING',
      explanation:
        'No participation or equipment requirements have been captured from the source. Requirements are unknown, not absent.',
    },
    {
      fieldPath: 'checkout.price',
      rawClaim: '$179.00 USD per year, billed annually — "1-Year Ballet Club (weekly classes)" (VSA checkout)',
      claimSourceType: 'MANUAL_CHECKOUT_VERIFICATION',
      claimSourceRef: CHECKOUT_REF,
      capturedAt: CHECKOUT_OBSERVED_AT,
      issueType: 'CONFLICTING',
      blockingCode: 'PRICE_CONFLICT',
      explanation:
        'The annual program offer in the current authoritative product data is $499 USD, while the captured VSA Stripe checkout for "1-Year Ballet Club (weekly classes)" displays $179 USD per year and says it is billed annually. The discrepancy has not been confirmed or explained by the business. Therefore the checkout must not be exposed as a payment action until the commercial terms are reconciled.',
    },
  ] as DataQualityIssueSeed[],
};

export type VsaSeed = typeof vsaSeed;
