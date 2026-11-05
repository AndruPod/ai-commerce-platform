// Test-only fixtures shaped like real responses captured from the local NestJS API.
// They are never used at runtime; the app always calls the real API.
import type { CommerceApi } from '@/lib/api/client';
import type { ChatResponse, CheckoutResponse, DateCheckResponse, EnrollmentView, ProductDetail, Provenance, ScheduleResponse } from '@/lib/api/types';

export const SLUG = '1-year-online-ballet-club';
export const BLOCKED_URL = 'https://buy.stripe.com/blocked-checkout-url-must-never-render';

const confirmed: Provenance = { sourceType: 'ASSIGNMENT_BRIEF', sourceRef: 'Assignment brief', verificationStatus: 'CONFIRMED', verifiedAt: '2026-10-03T00:00:00.000Z' };
const unknown: Provenance = { sourceType: null, sourceRef: null, verificationStatus: 'UNKNOWN', verifiedAt: null };

export const product: ProductDetail = {
  slug: SLUG,
  name: '1-Year Online Ballet Club',
  productType: 'GROUP_PROGRAM',
  deliveryMode: 'ONLINE_LIVE',
  discipline: 'BALLET',
  status: 'ACTIVE',
  business: { slug: 'victory-skating-academy', canonicalName: 'Victory Skating Academy', aliases: ['VSA', 'Victory Skating'] },
  durationMonths: 12,
  audienceLevels: ['ADVANCED', 'BEGINNER', 'PROFESSIONAL', 'RECREATIONAL'],
  description: null,
  offers: [{ label: 'Annual package', price: { amountMinor: 49900, currency: 'USD', display: '$499.00' }, pricingBasis: 'PACKAGE_TOTAL', paymentSchedule: 'UNKNOWN', paymentTerms: null, provenance: confirmed }],
  program: { durationMonths: 12, includedClasses: 48, classDurationMinutes: 60, provenance: confirmed },
  coaches: [{ displayName: 'Emilia', role: 'LEAD', provenance: confirmed }],
  accessPolicy: {
    entitlementDuration: { value: { months: 12 }, provenance: confirmed },
    startRule: { value: 'UNKNOWN', provenance: unknown },
    endRule: { value: 'UNKNOWN', provenance: unknown },
    completeness: 'PARTIAL',
  },
  requirements: { knowledge: 'NOT_PROVIDED', items: [] },
  openDataQualityIssues: 5,
};

const occurrence = (date: string, utc: string, londonTime: string) => ({
  status: 'CANDIDATE_UNCONFIRMED' as const,
  scheduleLocalDate: date,
  startsAtUtc: utc,
  endsAtUtc: utc,
  localTimes: {
    'America/Los_Angeles': { localDate: date, localTime: '11:00', weekday: 'SATURDAY', abbreviation: 'PST', utcOffset: '-08:00' },
    'Europe/London': { localDate: date, localTime: londonTime, weekday: 'SATURDAY', abbreviation: 'GMT', utcOffset: '+00:00' },
  },
});

export const schedule: ScheduleResponse = {
  recurrence: {
    frequency: 'WEEKLY',
    weekday: 'SATURDAY',
    localStartTime: '11:00',
    durationMinutes: 60,
    provenance: confirmed,
    canonicalTimezone: { value: 'America/Los_Angeles', provenance: { ...confirmed, verificationStatus: 'UNCONFIRMED', verifiedAt: null } },
  },
  exceptions: { knowledge: { status: 'NOT_PROVIDED', confirmedThrough: null }, items: [] },
  requestedDate: null,
  nextCandidateOccurrences: [occurrence('2026-10-10', '2026-10-10T18:00:00Z', '19:00')],
};

export const enrollment: EnrollmentView = {
  status: 'OPEN',
  evaluatedForDate: '2026-10-04',
  window: { kind: 'OPEN_ENDED', effectiveFrom: null, effectiveUntil: null },
  provenance: { sourceType: 'PROTOTYPE_CONFIG', sourceRef: 'Demo configuration for technical prototype; not confirmed by VSA', verificationStatus: 'UNCONFIRMED', verifiedAt: null },
};

export const PRICE_CONFLICT_MESSAGE =
  'The annual program offer in the current authoritative product data is $499 USD, while the captured VSA Stripe checkout displays $179 USD per year.';

/** Blocked checkout exactly as the API returns it: URL captured but withheld. */
export const blockedCheckout: CheckoutResponse = {
  product: { slug: SLUG, name: product.name },
  actions: [
    {
      type: 'EXTERNAL_CHECKOUT',
      provider: 'STRIPE',
      systemOfRecord: 'Stripe-hosted checkout (external system of record)',
      status: 'ACTIVE',
      urlCaptured: true,
      url: null,
      urlWithheld: true,
      usable: false,
      blockingIssues: [{ code: 'PRICE_CONFLICT', message: PRICE_CONFLICT_MESSAGE }],
      verification: { sourceType: 'MANUAL_CHECKOUT_VERIFICATION', sourceRef: 'Manual inspection', verificationStatus: 'CONFLICTING', verifiedAt: '2026-10-03T00:00:00.000Z' },
      offer: { label: 'Annual package', amountMinor: 49900, currency: 'USD', display: '$499.00' },
      observedTerms: {
        merchant: 'VSA',
        productLabel: '1-Year Ballet Club (weekly classes)',
        amountMinor: 17900,
        currency: 'USD',
        display: '$179.00',
        billing: 'ANNUAL',
        termsText: ['Billed annually'],
        observedAt: '2026-10-03',
        isAuthoritativeOffer: false,
      },
    },
  ],
};

export const dateCheck: DateCheckResponse = {
  product: { slug: SLUG, name: product.name },
  enrollment,
  requestedDate: { date: '2026-11-06', interpretedInTimezone: 'Europe/London', weekday: 'FRIDAY', matchesRecurrence: false, occurrencesOnDate: [] },
  schedule: { recurrence: schedule.recurrence, exceptions: { knowledge: { status: 'NOT_PROVIDED', confirmedThrough: null } } },
  nextCandidateOccurrences: [occurrence('2026-11-07', '2026-11-07T19:00:00Z', '19:00'), occurrence('2026-11-14', '2026-11-14T19:00:00Z', '19:00')],
  limitations: [],
};

export function chatResponse(overrides: Partial<ChatResponse> = {}): ChatResponse {
  return {
    message: 'Here is what I found.',
    actions: [],
    context: { productSlugs: [] },
    toolTrace: [],
    meta: { model: 'test-model', iterations: 1, stoppedReason: 'COMPLETED' },
    ...overrides,
  };
}

export const viewProduct = { type: 'VIEW_PRODUCT' as const, label: product.name, productSlug: SLUG, apiPath: `/products/${SLUG}` };
export const checkoutUnavailable = {
  type: 'CHECKOUT_UNAVAILABLE' as const,
  label: 'Online payment unavailable',
  productSlug: SLUG,
  reasons: [{ code: 'PRICE_CONFLICT', message: PRICE_CONFLICT_MESSAGE }],
};

/** In-memory CommerceApi stub; every method is a vi.fn() the test can override. */
export function stubApi(overrides: Partial<CommerceApi> = {}): CommerceApi & Record<string, ReturnType<typeof vi.fn>> {
  return {
    baseUrl: 'http://api.test',
    ping: vi.fn().mockResolvedValue(true),
    chat: vi.fn().mockResolvedValue(chatResponse()),
    getProduct: vi.fn().mockResolvedValue(product),
    getSchedule: vi.fn().mockResolvedValue(schedule),
    getEnrollment: vi.fn().mockResolvedValue(enrollment),
    getCheckout: vi.fn().mockResolvedValue(blockedCheckout),
    dateCheck: vi.fn().mockResolvedValue(dateCheck),
    ...overrides,
  } as CommerceApi & Record<string, ReturnType<typeof vi.fn>>;
}
