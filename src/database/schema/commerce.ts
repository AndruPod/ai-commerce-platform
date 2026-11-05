import { sql } from 'drizzle-orm';
import { char, check, date, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { businesses } from './business';
import { offers, products } from './product';
import {
  checkoutProviderEnum,
  checkoutStatusEnum,
  checkoutTypeEnum,
  dataQualityIssueStatusEnum,
  dataQualityIssueTypeEnum,
  enrollmentStatusEnum,
  observedBillingIntervalEnum,
  provenanceColumns,
  sourceTypeEnum,
  timestamps,
  transactionBlockCodeEnum,
} from './enums';

/**
 * Operational enrollment state. Independent of the class schedule, the
 * checkout link and any promotional dates; it is configured, never inferred.
 * Null effective dates mean an open-ended window.
 */
export const enrollmentAvailability = pgTable(
  'enrollment_availability',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    status: enrollmentStatusEnum('status').notNull(),
    effectiveFrom: date('effective_from', { mode: 'string' }),
    effectiveUntil: date('effective_until', { mode: 'string' }),
    notes: text('notes'),
    ...provenanceColumns(),
    ...timestamps(),
  },
  (t) => [
    check(
      'enrollment_window_order',
      sql`${t.effectiveFrom} IS NULL OR ${t.effectiveUntil} IS NULL OR ${t.effectiveUntil} >= ${t.effectiveFrom}`,
    ),
  ],
);

/**
 * Hand-off to the existing external checkout, which stays the system of
 * record for payments. A URL here never implies enrollment is open, and a
 * captured URL is not an approved checkout: usability is evaluated separately
 * (status, verification and blocking data-quality issues).
 *
 * observed_* columns record what the checkout page displayed when it was
 * manually inspected. They are evidence, never authoritative product terms;
 * the linked offer stays the authoritative price. Provenance describes how
 * the checkout's commercial terms check out against that offer.
 */
export const checkoutActions = pgTable(
  'checkout_actions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    offerId: uuid('offer_id').references(() => offers.id, { onDelete: 'set null' }),
    checkoutType: checkoutTypeEnum('checkout_type').notNull(),
    provider: checkoutProviderEnum('provider'),
    externalUrl: text('external_url'),
    status: checkoutStatusEnum('status').notNull(),
    systemOfRecord: text('system_of_record').notNull(),
    observedMerchant: text('observed_merchant'),
    observedProductLabel: text('observed_product_label'),
    observedAmountMinor: integer('observed_amount_minor'),
    observedCurrency: char('observed_currency', { length: 3 }),
    observedBilling: observedBillingIntervalEnum('observed_billing'),
    /** Verbatim payment wording shown on the checkout (cancellation, refund terms...). */
    observedTermsText: text('observed_terms_text').array().notNull().default(sql`'{}'::text[]`),
    observedAt: date('observed_at', { mode: 'string' }),
    ...provenanceColumns(),
    ...timestamps(),
  },
  (t) => [
    check('checkout_active_requires_url', sql`${t.status} <> 'ACTIVE' OR ${t.externalUrl} IS NOT NULL`),
    check('checkout_observed_amount_currency_together', sql`(${t.observedAmountMinor} IS NULL) = (${t.observedCurrency} IS NULL)`),
  ],
);

/**
 * Source claims that are conflicting, ambiguous, missing or unverified. These
 * are never surfaced as commerce data; they are only exposed via /data-quality.
 */
export const dataQualityIssues = pgTable('data_quality_issues', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id')
    .notNull()
    .references(() => businesses.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').references(() => products.id, { onDelete: 'cascade' }),
  fieldPath: text('field_path').notNull(),
  rawClaim: text('raw_claim'),
  claimSourceType: sourceTypeEnum('claim_source_type'),
  claimSourceRef: text('claim_source_ref'),
  capturedAt: timestamp('captured_at', { withTimezone: true }),
  issueType: dataQualityIssueTypeEnum('issue_type').notNull(),
  explanation: text('explanation').notNull(),
  status: dataQualityIssueStatusEnum('status').notNull().default('OPEN'),
  /** When set, this issue blocks the product's checkout action while it is OPEN. */
  blockingCode: transactionBlockCodeEnum('blocking_code'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
});
