import type { ProductListResponseDto } from '../../product/dto/product.response';
import { resolveSearch } from './search-resolution';

const item = (slug: string) => ({ slug, name: `Name ${slug}` }) as ProductListResponseDto['items'][number];
const result = (items: ProductListResponseDto['items'], businessResolution: ProductListResponseDto['businessResolution'] = null): ProductListResponseDto => ({
  items,
  businessResolution,
  appliedFilters: {},
});

describe('resolveSearch', () => {
  it('single plausible product is resolved automatically', () => {
    expect(resolveSearch(result([item('only-one')]), {})).toMatchObject({
      outcome: 'SINGLE_MATCH',
      matchCount: 1,
      singleMatch: { productSlug: 'only-one', name: 'Name only-one' },
      nextStep: expect.stringMatching(/call get_product .* Do not search again/),
    });
  });

  it('multiple plausible products lead to clarification guidance', () => {
    const r = resolveSearch(result([item('group-program'), item('private-lessons')]), { discipline: 'BALLET' });
    expect(r).toMatchObject({ outcome: 'MULTIPLE_MATCHES', matchCount: 2, singleMatch: null });
    expect(r.nextStep).toMatch(/ask the user which one they mean/);
  });

  it('unresolved business name -> one retry with a single name or without business', () => {
    const r = resolveSearch(
      result([], { requested: 'A / B', matchedBusinessSlug: null, matchedBy: null, matchedValue: null }),
      { business: 'A / B' },
    );
    expect(r.outcome).toBe('NO_MATCH_BUSINESS_UNRESOLVED');
    expect(r.nextStep).toMatch(/Retry once with a single business name/);
  });

  it('no match with filters -> one broader retry, dropping q first, then stop', () => {
    const r = resolveSearch(result([]), { q: 'annual', deliveryMode: 'IN_PERSON' });
    expect(r.outcome).toBe('NO_MATCH');
    expect(r.nextStep).toMatch(/Retry once with fewer filters \(drop "q" first/);
    expect(r.nextStep).toMatch(/then stop/);
  });

  it('empty catalog with no filters', () => {
    expect(resolveSearch(result([]), {}).nextStep).toBe('There are no active products in the catalog.');
  });
});
