import { sql } from 'drizzle-orm';
import { char, check, integer, pgTable, primaryKey, text, uuid } from 'drizzle-orm/pg-core';
import { businesses, coaches } from './business';
import {
  accessEndRuleEnum,
  accessStartRuleEnum,
  coachRoleEnum,
  deliveryModeEnum,
  disciplineEnum,
  experienceLevelEnum,
  paymentScheduleEnum,
  pricingBasisEnum,
  productStatusEnum,
  productTypeEnum,
  provenanceColumns,
  requirementCategoryEnum,
  timestamps,
} from './enums';

// Every table below is owned by exactly one product (product_id FK). Nothing is
// shared between products, which keeps the annual group program isolated from
// private lessons or monthly plans added later.

export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id')
    .notNull()
    .references(() => businesses.id, { onDelete: 'cascade' }),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  productType: productTypeEnum('product_type').notNull(),
  deliveryMode: deliveryModeEnum('delivery_mode').notNull(),
  discipline: disciplineEnum('discipline').notNull(),
  description: text('description'),
  status: productStatusEnum('status').notNull().default('DRAFT'),
  ...timestamps(),
});

export const productAudienceLevels = pgTable(
  'product_audience_levels',
  {
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    level: experienceLevelEnum('level').notNull(),
    ...provenanceColumns(),
  },
  (t) => [primaryKey({ columns: [t.productId, t.level] })],
);

export const offers = pgTable(
  'offers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    /** Minor units (cents). Null = price not known. */
    amountMinor: integer('amount_minor'),
    currency: char('currency', { length: 3 }),
    pricingBasis: pricingBasisEnum('pricing_basis').notNull(),
    /** How the price is paid (once, installments, ...). Kept separate so it is never inferred from the price. */
    paymentSchedule: paymentScheduleEnum('payment_schedule').notNull().default('UNKNOWN'),
    paymentTerms: text('payment_terms'),
    ...provenanceColumns(),
    ...timestamps(),
  },
  (t) => [
    check('offers_amount_non_negative', sql`${t.amountMinor} IS NULL OR ${t.amountMinor} >= 0`),
    check('offers_amount_currency_together', sql`(${t.amountMinor} IS NULL) = (${t.currency} IS NULL)`),
  ],
);

export const programs = pgTable(
  'programs',
  {
    productId: uuid('product_id')
      .primaryKey()
      .references(() => products.id, { onDelete: 'cascade' }),
    durationMonths: integer('duration_months').notNull(),
    includedClassCount: integer('included_class_count').notNull(),
    classDurationMinutes: integer('class_duration_minutes').notNull(),
    ...provenanceColumns(),
  },
  (t) => [
    check(
      'programs_positive_values',
      sql`${t.durationMonths} > 0 AND ${t.includedClassCount} > 0 AND ${t.classDurationMinutes} > 0`,
    ),
  ],
);

export const productCoaches = pgTable(
  'product_coaches',
  {
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    coachId: uuid('coach_id')
      .notNull()
      .references(() => coaches.id, { onDelete: 'cascade' }),
    role: coachRoleEnum('role').notNull(),
    ...provenanceColumns(),
  },
  (t) => [primaryKey({ columns: [t.productId, t.coachId] })],
);

/** Zero rows for a product means "requirements not provided", NOT "no requirements". */
export const productRequirements = pgTable('product_requirements', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'cascade' }),
  category: requirementCategoryEnum('category').notNull(),
  description: text('description').notNull(),
  ...provenanceColumns(),
});

const dur = () => provenanceColumns('duration_');
const startRule = () => provenanceColumns('start_rule_');
const endRule = () => provenanceColumns('end_rule_');

/**
 * Access entitlement. Duration, start rule and end rule are verified
 * independently, so each carries its own provenance group.
 */
export const accessPolicies = pgTable(
  'access_policies',
  {
    productId: uuid('product_id')
      .primaryKey()
      .references(() => products.id, { onDelete: 'cascade' }),
    entitlementDurationMonths: integer('entitlement_duration_months'),
    durationSourceType: dur().sourceType,
    durationSourceRef: dur().sourceRef,
    durationVerificationStatus: dur().verificationStatus,
    durationVerifiedAt: dur().verifiedAt,
    startRule: accessStartRuleEnum('start_rule').notNull().default('UNKNOWN'),
    startRuleSourceType: startRule().sourceType,
    startRuleSourceRef: startRule().sourceRef,
    startRuleVerificationStatus: startRule().verificationStatus,
    startRuleVerifiedAt: startRule().verifiedAt,
    endRule: accessEndRuleEnum('end_rule').notNull().default('UNKNOWN'),
    endRuleSourceType: endRule().sourceType,
    endRuleSourceRef: endRule().sourceRef,
    endRuleVerificationStatus: endRule().verificationStatus,
    endRuleVerifiedAt: endRule().verifiedAt,
  },
  (t) => [
    check(
      'access_policies_duration_positive',
      sql`${t.entitlementDurationMonths} IS NULL OR ${t.entitlementDurationMonths} > 0`,
    ),
  ],
);
