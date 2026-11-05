// Single source of truth for domain enums. The Drizzle schema builds Postgres
// enums from these arrays and DTO validation uses them for @IsIn checks.

export const VERIFICATION_STATUSES = ['CONFIRMED', 'UNCONFIRMED', 'CONFLICTING', 'UNKNOWN'] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

/**
 * Where a fact came from.
 * - LANDING_PAGE: captured directly from the public landing page.
 * - ASSIGNMENT_BRIEF: supplied through the assignment brief (may describe the landing page, but not captured by us).
 * - BUSINESS_APPROVED_CONFIG: operational value explicitly approved by VSA.
 * - PROTOTYPE_CONFIG: operational value set by the project team for the demo; NOT approved by VSA.
 * - MANUAL_CHECKOUT_VERIFICATION: what an external checkout page displayed when a person opened it.
 *   It confirms what the checkout shows, NOT which commercial terms the business intends.
 * - DERIVED: computed by this system from other facts. Never stored; only produced at read time.
 */
export const SOURCE_TYPES = [
  'LANDING_PAGE',
  'ASSIGNMENT_BRIEF',
  'BUSINESS_APPROVED_CONFIG',
  'PROTOTYPE_CONFIG',
  'MANUAL_CHECKOUT_VERIFICATION',
  'DERIVED',
] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const PRODUCT_TYPES = ['GROUP_PROGRAM', 'PRIVATE_LESSON', 'SUBSCRIPTION'] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

export const DELIVERY_MODES = ['ONLINE_LIVE', 'IN_PERSON', 'HYBRID'] as const;
export type DeliveryMode = (typeof DELIVERY_MODES)[number];

export const DISCIPLINES = ['BALLET'] as const;
export type Discipline = (typeof DISCIPLINES)[number];

export const PRODUCT_STATUSES = ['DRAFT', 'ACTIVE', 'ARCHIVED'] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const EXPERIENCE_LEVELS = ['BEGINNER', 'RECREATIONAL', 'ADVANCED', 'PROFESSIONAL'] as const;
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

export const PRICING_BASES = ['PACKAGE_TOTAL', 'PER_PERIOD', 'PER_CLASS'] as const;
export type PricingBasis = (typeof PRICING_BASES)[number];

export const PAYMENT_SCHEDULES = ['UNKNOWN', 'ONE_TIME', 'INSTALLMENTS', 'RECURRING'] as const;
export type PaymentSchedule = (typeof PAYMENT_SCHEDULES)[number];

export const COACH_ROLES = ['LEAD', 'ASSISTANT'] as const;
export type CoachRole = (typeof COACH_ROLES)[number];

export const RECURRENCE_FREQUENCIES = ['WEEKLY'] as const;
export type RecurrenceFrequency = (typeof RECURRENCE_FREQUENCIES)[number];

/** Index + 1 is the ISO weekday number (Monday = 1 ... Sunday = 7). */
export const WEEKDAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const SCHEDULE_EXCEPTION_TYPES = ['CANCELLED', 'RESCHEDULED', 'ADDITIONAL'] as const;
export type ScheduleExceptionType = (typeof SCHEDULE_EXCEPTION_TYPES)[number];

export const ENROLLMENT_STATUSES = ['OPEN', 'CLOSED', 'UNKNOWN'] as const;
export type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number];

export const ACCESS_START_RULES = ['UNKNOWN', 'ON_PURCHASE', 'ON_FIRST_CLASS', 'FIXED_DATE'] as const;
export type AccessStartRule = (typeof ACCESS_START_RULES)[number];

export const ACCESS_END_RULES = ['UNKNOWN', 'DURATION_AFTER_START', 'FIXED_DATE'] as const;
export type AccessEndRule = (typeof ACCESS_END_RULES)[number];

export const REQUIREMENT_CATEGORIES = ['EQUIPMENT', 'PARTICIPATION', 'TECHNICAL'] as const;
export type RequirementCategory = (typeof REQUIREMENT_CATEGORIES)[number];

export const CHECKOUT_TYPES = ['EXTERNAL_CHECKOUT'] as const;
export type CheckoutType = (typeof CHECKOUT_TYPES)[number];

/** Operational state of the external checkout (ACTIVE = observed live at the provider). Not an approval. */
export const CHECKOUT_STATUSES = ['ACTIVE', 'INACTIVE', 'UNVERIFIED', 'NOT_CAPTURED'] as const;
export type CheckoutStatus = (typeof CHECKOUT_STATUSES)[number];

export const CHECKOUT_PROVIDERS = ['STRIPE', 'OTHER'] as const;
export type CheckoutProvider = (typeof CHECKOUT_PROVIDERS)[number];

/** Billing interval as displayed by an external checkout (an observation, not authoritative terms). */
export const OBSERVED_BILLING_INTERVALS = ['ONE_TIME', 'MONTHLY', 'ANNUAL'] as const;
export type ObservedBillingInterval = (typeof OBSERVED_BILLING_INTERVALS)[number];

/** Material commerce conflicts that block a checkout action while their data-quality issue is OPEN. */
export const TRANSACTION_BLOCK_CODES = ['PRICE_CONFLICT', 'PAYMENT_TERMS_CONFLICT'] as const;
export type TransactionBlockCode = (typeof TRANSACTION_BLOCK_CODES)[number];

export const DATA_QUALITY_ISSUE_TYPES = ['CONFLICTING', 'UNVERIFIED', 'MISSING', 'OUTDATED', 'AMBIGUOUS'] as const;
export type DataQualityIssueType = (typeof DATA_QUALITY_ISSUE_TYPES)[number];

export const DATA_QUALITY_ISSUE_STATUSES = ['OPEN', 'RESOLVED', 'DISMISSED'] as const;
export type DataQualityIssueStatus = (typeof DATA_QUALITY_ISSUE_STATUSES)[number];
