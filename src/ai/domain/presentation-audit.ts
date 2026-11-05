import * as E from '../../common/enums';

/**
 * Detects implementation vocabulary leaking into customer-facing prose: raw
 * status/enum codes, API field names and tool names. Used for logging and for
 * the live evaluation report; it never rewrites the message.
 */
const CODE_VALUES = [
  ...E.VERIFICATION_STATUSES,
  ...E.SOURCE_TYPES,
  ...E.PRODUCT_TYPES,
  ...E.DELIVERY_MODES,
  ...E.DISCIPLINES,
  ...E.EXPERIENCE_LEVELS,
  ...E.PRICING_BASES,
  ...E.PAYMENT_SCHEDULES,
  ...E.ACCESS_START_RULES,
  ...E.ACCESS_END_RULES,
  ...E.CHECKOUT_STATUSES,
  ...E.ENROLLMENT_STATUSES,
  ...E.CHECKOUT_PROVIDERS,
  ...E.TRANSACTION_BLOCK_CODES,
  ...E.CHECKOUT_TYPES,
  // schedule/date-check vocabulary
  'SCHEDULED_CONFIRMED',
  'CANDIDATE_UNCONFIRMED',
  'NOT_PROVIDED',
  'CONFIRMED_THROUGH',
  'CURRENT_CONFIGURATION',
  // checkout eligibility vocabulary
  'URL_NOT_CAPTURED',
  'CHECKOUT_NOT_ACTIVE',
  'CHECKOUT_TERMS_CONFLICTING',
  'CHECKOUT_UNAVAILABLE',
];

const FIELD_NAMES = [
  'sourceType',
  'sourceRef',
  'verificationStatus',
  'pricingBasis',
  'paymentSchedule',
  'productSlug',
  'startRule',
  'endRule',
  'dataQualityWarnings',
  'matchesRecurrence',
  'nextCandidateOccurrences',
  'isPublishedFact',
  'blockingIssues',
  'observedTerms',
  'urlWithheld',
  'urlCaptured',
  'slug',
];

const TOOL_NAMES = ['search_products', 'get_product', 'check_date', 'get_enrollment', 'get_checkout'];

// Case-sensitive, whole-token: "UNKNOWN" is flagged, "unknown" in prose is not.
const PATTERNS: { term: string; re: RegExp }[] = [...new Set([...CODE_VALUES, ...FIELD_NAMES, ...TOOL_NAMES])].map((term) => ({
  term,
  re: new RegExp(`(?<![A-Za-z0-9_-])${term}(?![A-Za-z0-9_])`),
}));

export function findInternalTerms(text: string): string[] {
  return PATTERNS.filter((p) => p.re.test(text)).map((p) => p.term);
}
