// Maps structured API values (enum codes) to customer-facing labels. Raw codes
// stay available in the technical panel; primary UI uses these helpers only.

import type { Provenance } from './api/types';

const titleCase = (s: string) => s.toLowerCase().replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

const LEVELS: Record<string, string> = {
  BEGINNER: 'Beginner',
  RECREATIONAL: 'Recreational',
  ADVANCED: 'Advanced',
  PROFESSIONAL: 'Professional',
};
const LEVEL_ORDER = Object.keys(LEVELS);

const DELIVERY: Record<string, string> = { ONLINE_LIVE: 'Online · Live', IN_PERSON: 'In person', HYBRID: 'Hybrid' };
const PRODUCT_TYPES: Record<string, string> = { GROUP_PROGRAM: 'Group program', PRIVATE_LESSON: 'Private lessons', SUBSCRIPTION: 'Subscription' };
const PRICING_BASIS: Record<string, string> = { PACKAGE_TOTAL: 'Package total', PER_PERIOD: 'Per period', PER_CLASS: 'Per class' };
const PAYMENT_SCHEDULE: Record<string, string | null> = {
  UNKNOWN: null,
  ONE_TIME: 'Paid in one payment',
  INSTALLMENTS: 'Paid in instalments',
  RECURRING: 'Recurring payments',
};
const BILLING: Record<string, string> = { ANNUAL: 'year', MONTHLY: 'month', ONE_TIME: '' };
const WEEKDAYS_PLURAL: Record<string, string> = {
  MONDAY: 'Mondays',
  TUESDAY: 'Tuesdays',
  WEDNESDAY: 'Wednesdays',
  THURSDAY: 'Thursdays',
  FRIDAY: 'Fridays',
  SATURDAY: 'Saturdays',
  SUNDAY: 'Sundays',
};

export const levelLabel = (code: string) => LEVELS[code] ?? titleCase(code);
const levelRank = (code: string) => {
  const i = LEVEL_ORDER.indexOf(code);
  return i === -1 ? LEVEL_ORDER.length : i;
};
export const sortLevels = (codes: string[]) => [...codes].sort((a, b) => levelRank(a) - levelRank(b));
export const deliveryLabel = (code: string) => DELIVERY[code] ?? titleCase(code);
export const productTypeLabel = (code: string) => PRODUCT_TYPES[code] ?? titleCase(code);
export const pricingBasisLabel = (code: string) => PRICING_BASIS[code] ?? titleCase(code);
export const paymentScheduleLabel = (code: string) => (code in PAYMENT_SCHEDULE ? PAYMENT_SCHEDULE[code] : titleCase(code));
export const weekdayPlural = (code: string) => WEEKDAYS_PLURAL[code] ?? titleCase(code);
export const weekdayLabel = (code: string) => titleCase(code);

/** "$499 USD" (cents only when not whole). */
export function formatMoney(amountMinor: number, currency: string): string {
  const whole = amountMinor % 100 === 0;
  const n = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);
  return `${n} ${currency}`;
}

export const billingSuffix = (code: string | null) => (code && BILLING[code] ? ` / ${BILLING[code]}` : '');

export function durationLabel(months: number): string {
  if (months % 12 === 0) {
    const years = months / 12;
    return years === 1 ? '1 year' : `${years} years`;
  }
  return months === 1 ? '1 month' : `${months} months`;
}

/** "Friday, November 6, 2026" for a calendar date (no timezone shift). */
export function formatCalendarDate(isoDate: string): string {
  return new Date(`${isoDate}T12:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** "Los Angeles time" from an IANA zone. */
export function zoneLabel(zone: string): string {
  if (zone === 'UTC') return 'UTC';
  const city = zone.split('/').pop()!.replace(/_/g, ' ');
  return `${city} time`;
}

/**
 * Plain-language qualifier for a value that is not fully confirmed, or null
 * when it is confirmed. Never returns raw codes.
 */
export function provenanceNote(p: Provenance | null | undefined, businessName: string): string | null {
  if (!p) return 'Not specified in the available product information.';
  if (p.sourceType === 'PROTOTYPE_CONFIG') return `Shown as open in the prototype; not confirmed by ${businessName}.`;
  switch (p.verificationStatus) {
    case 'CONFIRMED':
      return null;
    case 'UNCONFIRMED':
      return `Not yet confirmed by ${businessName}.`;
    case 'CONFLICTING':
      return 'Sources conflict; needs business confirmation.';
    default:
      return 'Not specified in the available product information.';
  }
}

export function enrollmentLabel(status: string): string {
  return status === 'OPEN' ? 'Open' : status === 'CLOSED' ? 'Closed' : 'Unknown';
}

/** Customer-facing headline and explanation for checkout blocking codes. */
export function checkoutBlockCopy(code: string): { headline: string; explanation: string } {
  switch (code) {
    case 'PRICE_CONFLICT':
      return {
        headline: 'Verification required',
        explanation: 'Published program pricing and the captured checkout pricing do not currently match.',
      };
    case 'PAYMENT_TERMS_CONFLICT':
    case 'CHECKOUT_TERMS_CONFLICTING':
      return {
        headline: 'Verification required',
        explanation: 'The checkout terms do not currently match the published program offer.',
      };
    case 'URL_NOT_CAPTURED':
      return { headline: 'Not connected yet', explanation: 'An online payment link has not been connected in this prototype yet.' };
    case 'CHECKOUT_NOT_ACTIVE':
      return { headline: 'Unavailable', explanation: 'The payment page is not currently active.' };
    default:
      return { headline: 'Unavailable', explanation: 'Online payment is not available right now.' };
  }
}

export const TOOL_LABELS: Record<string, string> = {
  search_products: 'Search catalog',
  get_product: 'Product details',
  check_date: 'Date check',
  get_enrollment: 'Enrollment',
  get_checkout: 'Checkout',
};
