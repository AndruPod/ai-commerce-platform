import { pgEnum, text, timestamp } from 'drizzle-orm/pg-core';
import * as E from '../../common/enums';

export const verificationStatusEnum = pgEnum('verification_status', E.VERIFICATION_STATUSES);
export const sourceTypeEnum = pgEnum('source_type', E.SOURCE_TYPES);
export const productTypeEnum = pgEnum('product_type', E.PRODUCT_TYPES);
export const deliveryModeEnum = pgEnum('delivery_mode', E.DELIVERY_MODES);
export const disciplineEnum = pgEnum('discipline', E.DISCIPLINES);
export const productStatusEnum = pgEnum('product_status', E.PRODUCT_STATUSES);
export const experienceLevelEnum = pgEnum('experience_level', E.EXPERIENCE_LEVELS);
export const pricingBasisEnum = pgEnum('pricing_basis', E.PRICING_BASES);
export const paymentScheduleEnum = pgEnum('payment_schedule', E.PAYMENT_SCHEDULES);
export const coachRoleEnum = pgEnum('coach_role', E.COACH_ROLES);
export const recurrenceFrequencyEnum = pgEnum('recurrence_frequency', E.RECURRENCE_FREQUENCIES);
export const scheduleExceptionTypeEnum = pgEnum('schedule_exception_type', E.SCHEDULE_EXCEPTION_TYPES);
export const enrollmentStatusEnum = pgEnum('enrollment_status', E.ENROLLMENT_STATUSES);
export const accessStartRuleEnum = pgEnum('access_start_rule', E.ACCESS_START_RULES);
export const accessEndRuleEnum = pgEnum('access_end_rule', E.ACCESS_END_RULES);
export const requirementCategoryEnum = pgEnum('requirement_category', E.REQUIREMENT_CATEGORIES);
export const checkoutTypeEnum = pgEnum('checkout_type', E.CHECKOUT_TYPES);
export const checkoutStatusEnum = pgEnum('checkout_status', E.CHECKOUT_STATUSES);
export const checkoutProviderEnum = pgEnum('checkout_provider', E.CHECKOUT_PROVIDERS);
export const observedBillingIntervalEnum = pgEnum('observed_billing_interval', E.OBSERVED_BILLING_INTERVALS);
export const transactionBlockCodeEnum = pgEnum('transaction_block_code', E.TRANSACTION_BLOCK_CODES);
export const dataQualityIssueTypeEnum = pgEnum('data_quality_issue_type', E.DATA_QUALITY_ISSUE_TYPES);
export const dataQualityIssueStatusEnum = pgEnum('data_quality_issue_status', E.DATA_QUALITY_ISSUE_STATUSES);

/**
 * Builders for one provenance column group: source type + source reference +
 * verification status + verification timestamp. Call once per group; pass a
 * column-name prefix when a row carries more than one group (e.g. 'tz_').
 */
export function provenanceColumns(prefix = '') {
  return {
    sourceType: sourceTypeEnum(`${prefix}source_type`),
    sourceRef: text(`${prefix}source_ref`),
    verificationStatus: verificationStatusEnum(`${prefix}verification_status`).notNull().default('UNKNOWN'),
    verifiedAt: timestamp(`${prefix}verified_at`, { withTimezone: true }),
  };
}

export const timestamps = () => ({
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
