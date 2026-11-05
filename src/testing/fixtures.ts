// Test-only row fixtures built from the real seed data, so unit tests exercise
// the same facts the database is seeded with.
import type { EnrollmentRow } from '../enrollment/enrollment.repository';
import type { ScheduleExceptionRow, ScheduleRow } from '../schedule/schedule.repository';
import type { AccessPolicyRow, OfferRow } from '../product/product.repository';
import type { CheckoutActionRow } from '../checkout/checkout.repository';
import { vsaSeed as d } from '../database/seed/vsa-annual-ballet.data';

const T = new Date('2026-10-03T00:00:00.000Z');

export function scheduleRow(overrides: Partial<ScheduleRow> = {}): ScheduleRow {
  const s = d.schedule;
  return {
    id: 'schedule-1',
    productId: 'product-1',
    frequency: s.frequency,
    isoWeekday: s.isoWeekday,
    localStartTime: `${s.localStartTime}:00`,
    durationMinutes: s.durationMinutes,
    timezone: s.timezone,
    tzSourceType: s.timezoneProvenance.sourceType,
    tzSourceRef: s.timezoneProvenance.sourceRef,
    tzVerificationStatus: s.timezoneProvenance.verificationStatus,
    tzVerifiedAt: s.timezoneProvenance.verifiedAt,
    publishedTimeLabels: s.publishedTimeLabels,
    exceptionsConfirmedThrough: s.exceptionsConfirmedThrough,
    exceptionsSourceType: s.exceptionsProvenance.sourceType,
    exceptionsSourceRef: s.exceptionsProvenance.sourceRef,
    exceptionsVerificationStatus: s.exceptionsProvenance.verificationStatus,
    exceptionsVerifiedAt: s.exceptionsProvenance.verifiedAt,
    ...s.provenance,
    createdAt: T,
    updatedAt: T,
    ...overrides,
  };
}

export function cancelledException(originalDate: string): ScheduleExceptionRow {
  return {
    id: `exc-${originalDate}`,
    scheduleId: 'schedule-1',
    type: 'CANCELLED',
    originalDate,
    replacementDate: null,
    replacementStartTime: null,
    reason: 'Test cancellation',
    sourceType: 'BUSINESS_APPROVED_CONFIG',
    sourceRef: 'test',
    verificationStatus: 'CONFIRMED',
    verifiedAt: T,
  };
}

export function enrollmentRow(overrides: Partial<EnrollmentRow> = {}): EnrollmentRow {
  const { provenance, ...e } = d.enrollment;
  return { id: 'enrollment-1', productId: 'product-1', ...e, ...provenance, createdAt: T, updatedAt: T, ...overrides };
}

export function offerRow(overrides: Partial<OfferRow> = {}): OfferRow {
  const { provenance, ...o } = d.offer;
  return { id: 'offer-1', productId: 'product-1', ...o, ...provenance, createdAt: T, updatedAt: T, ...overrides };
}

export function accessPolicyRow(): AccessPolicyRow {
  const a = d.accessPolicy;
  return {
    productId: 'product-1',
    entitlementDurationMonths: a.entitlementDurationMonths,
    durationSourceType: a.durationProvenance.sourceType,
    durationSourceRef: a.durationProvenance.sourceRef,
    durationVerificationStatus: a.durationProvenance.verificationStatus,
    durationVerifiedAt: a.durationProvenance.verifiedAt,
    startRule: a.startRule,
    startRuleSourceType: a.startRuleProvenance.sourceType,
    startRuleSourceRef: a.startRuleProvenance.sourceRef,
    startRuleVerificationStatus: a.startRuleProvenance.verificationStatus,
    startRuleVerifiedAt: a.startRuleProvenance.verifiedAt,
    endRule: a.endRule,
    endRuleSourceType: a.endRuleProvenance.sourceType,
    endRuleSourceRef: a.endRuleProvenance.sourceRef,
    endRuleVerificationStatus: a.endRuleProvenance.verificationStatus,
    endRuleVerifiedAt: a.endRuleProvenance.verifiedAt,
  };
}

export function checkoutRow(overrides: Partial<CheckoutActionRow> = {}): CheckoutActionRow {
  const { provenance, ...c } = d.checkout;
  return { id: 'checkout-1', productId: 'product-1', offerId: 'offer-1', ...c, ...provenance, createdAt: T, updatedAt: T, ...overrides };
}

/** The seeded checkout.price issue as CheckoutRepository.openBlockingIssues returns it. */
export function seededPriceConflict(): { code: 'PRICE_CONFLICT'; message: string } {
  const issue = d.dataQualityIssues.find((i) => i.blockingCode === 'PRICE_CONFLICT')!;
  return { code: 'PRICE_CONFLICT', message: issue.explanation };
}
