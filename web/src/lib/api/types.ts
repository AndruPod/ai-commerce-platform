// Subset of the NestJS response DTOs the demo UI consumes. These mirror the
// backend contracts (src/**/dto/*.response.ts); keep them in sync when they change.

export type VerificationStatus = 'CONFIRMED' | 'UNCONFIRMED' | 'CONFLICTING' | 'UNKNOWN';
export type SourceType =
  | 'LANDING_PAGE'
  | 'ASSIGNMENT_BRIEF'
  | 'BUSINESS_APPROVED_CONFIG'
  | 'PROTOTYPE_CONFIG'
  | 'MANUAL_CHECKOUT_VERIFICATION'
  | 'DERIVED';

export interface Provenance {
  sourceType: SourceType | null;
  sourceRef: string | null;
  verificationStatus: VerificationStatus;
  verifiedAt: string | null;
}

export interface Fact<T> {
  value: T | null;
  provenance: Provenance;
}

// ---- /ai/chat ---------------------------------------------------------------

export interface ChatHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
  productSlugs?: string[];
}

export interface ChatRequest {
  message: string;
  timezone?: string;
  history?: ChatHistoryMessage[];
}

export type ChatAction =
  | {
      type: 'CHECKOUT';
      label: string;
      url: string;
      productSlug: string;
      offer: { label: string; amountMinor: number | null; currency: string | null; display: string | null } | null;
      systemOfRecord: string;
    }
  | { type: 'VIEW_PRODUCT'; label: string; productSlug: string; apiPath: string }
  | { type: 'CHECKOUT_UNAVAILABLE'; label: string; productSlug: string; reasons: { code: string; message: string }[] };

export interface ToolTraceEntry {
  tool: string;
  success: boolean;
  durationMs: number;
  arguments: Record<string, unknown> | null;
  errorCode: string | null;
}

export interface ChatResponse {
  message: string;
  actions: ChatAction[];
  context: { productSlugs: string[] };
  toolTrace: ToolTraceEntry[];
  meta: { model: string; iterations: number; stoppedReason: 'COMPLETED' | 'MAX_TOOL_ITERATIONS' };
}

// ---- /products/:slug ----------------------------------------------------------

export interface ProductDetail {
  slug: string;
  name: string;
  productType: string;
  deliveryMode: string;
  discipline: string;
  status: string;
  business: { slug: string; canonicalName: string; aliases: string[] };
  durationMonths: number | null;
  audienceLevels: string[];
  description: string | null;
  offers: {
    label: string;
    price: { amountMinor: number; currency: string; display: string } | null;
    pricingBasis: string;
    paymentSchedule: string;
    paymentTerms: string | null;
    provenance: Provenance;
  }[];
  program: { durationMonths: number; includedClasses: number; classDurationMinutes: number; provenance: Provenance } | null;
  coaches: { displayName: string; role: string; provenance: Provenance }[];
  accessPolicy: {
    entitlementDuration: Fact<{ months: number }>;
    startRule: Fact<string>;
    endRule: Fact<string>;
    completeness: 'COMPLETE' | 'PARTIAL' | 'NONE';
  } | null;
  requirements: { knowledge: 'NOT_PROVIDED' | 'PROVIDED'; items: { category: string; description: string }[] };
  openDataQualityIssues: number;
}

// ---- /products/:slug/schedule and /date-check ---------------------------------

export interface ZonedTime {
  localDate: string;
  localTime: string;
  weekday: string;
  abbreviation: string;
  utcOffset: string;
}

export interface Occurrence {
  status: 'SCHEDULED_CONFIRMED' | 'CANDIDATE_UNCONFIRMED' | 'CANCELLED' | 'RESCHEDULED' | 'ADDITIONAL';
  scheduleLocalDate: string;
  startsAtUtc: string;
  endsAtUtc: string;
  localTimes: Record<string, ZonedTime>;
}

export interface Recurrence {
  frequency: string;
  weekday: string;
  localStartTime: string | null;
  durationMinutes: number;
  provenance: Provenance;
  canonicalTimezone: Fact<string>;
}

export interface ExceptionsKnowledge {
  status: 'NOT_PROVIDED' | 'CONFIRMED_THROUGH';
  confirmedThrough: string | null;
}

export interface RequestedDate {
  date: string;
  interpretedInTimezone: string;
  weekday: string;
  matchesRecurrence: boolean;
  occurrencesOnDate: Occurrence[];
}

export interface ScheduleResponse {
  recurrence: Recurrence;
  exceptions: { knowledge: ExceptionsKnowledge; items: unknown[] };
  requestedDate: RequestedDate | null;
  nextCandidateOccurrences: Occurrence[];
}

export interface EnrollmentView {
  status: 'OPEN' | 'CLOSED' | 'UNKNOWN';
  evaluatedForDate: string;
  window: { kind: string; effectiveFrom: string | null; effectiveUntil: string | null } | null;
  provenance: Provenance | null;
}

export interface DateCheckResponse {
  product: { slug: string; name: string };
  enrollment: EnrollmentView;
  requestedDate: RequestedDate | null;
  schedule: { recurrence: Recurrence; exceptions: { knowledge: ExceptionsKnowledge } } | null;
  nextCandidateOccurrences: Occurrence[];
  limitations: { code: string; message: string }[];
}

// ---- /products/:slug/checkout ---------------------------------------------------

export interface CheckoutAction {
  type: string;
  provider: string | null;
  systemOfRecord: string;
  status: string;
  urlCaptured: boolean;
  url: string | null;
  urlWithheld: boolean;
  usable: boolean;
  blockingIssues: { code: string; message: string }[];
  verification: Provenance;
  offer: { label: string; amountMinor: number | null; currency: string | null; display: string | null } | null;
  observedTerms: {
    merchant: string | null;
    productLabel: string | null;
    amountMinor: number | null;
    currency: string | null;
    display: string | null;
    billing: string | null;
    termsText: string[];
    observedAt: string | null;
    isAuthoritativeOffer: false;
  } | null;
}

export interface CheckoutResponse {
  product: { slug: string; name: string };
  actions: CheckoutAction[];
}
