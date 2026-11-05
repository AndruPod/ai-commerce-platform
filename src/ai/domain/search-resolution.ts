import type { ProductListResponseDto } from '../../product/dto/product.response';

/**
 * Deterministic, data-driven hints attached to search_products results (tool
 * layer only). They encode the generic resolution strategy so the model does
 * not have to infer it: one match -> use it; none -> one broader retry;
 * several -> clarify only if they differ materially.
 */
export type SearchOutcome = 'SINGLE_MATCH' | 'MULTIPLE_MATCHES' | 'NO_MATCH_BUSINESS_UNRESOLVED' | 'NO_MATCH';

export interface SearchResolution {
  outcome: SearchOutcome;
  matchCount: number;
  singleMatch: { productSlug: string; name: string } | null;
  nextStep: string;
}

export function resolveSearch(result: ProductListResponseDto, args: Record<string, unknown>): SearchResolution {
  const matchCount = result.items.length;
  if (matchCount === 1) {
    const [p] = result.items;
    return {
      outcome: 'SINGLE_MATCH',
      matchCount,
      singleMatch: { productSlug: p.slug, name: p.name },
      nextStep: 'Exactly one product matched. Treat it as the product the user means and call get_product (or the tool you need) with its productSlug. Do not search again.',
    };
  }
  if (matchCount > 1) {
    return {
      outcome: 'MULTIPLE_MATCHES',
      matchCount,
      singleMatch: null,
      nextStep: 'Several products matched. If they differ in ways that matter for the question, ask the user which one they mean; otherwise answer for each separately.',
    };
  }
  if (result.businessResolution && result.businessResolution.matchedBusinessSlug === null) {
    return {
      outcome: 'NO_MATCH_BUSINESS_UNRESOLVED',
      matchCount,
      singleMatch: null,
      nextStep: 'The business filter did not resolve to a known business. Retry once with a single business name or alias as written by the user, or without the business filter.',
    };
  }
  const usedFilters = Object.keys(args);
  return {
    outcome: 'NO_MATCH',
    matchCount,
    singleMatch: null,
    nextStep:
      usedFilters.length > 0
        ? `No product matched all filters (${usedFilters.join(', ')}). Retry once with fewer filters (drop "q" first, since it is a literal name match), then stop and tell the user nothing matched.`
        : 'There are no active products in the catalog.',
  };
}
