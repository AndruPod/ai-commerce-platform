/**
 * Runs the real HTTP stack against the migrated + seeded database
 * (`pnpm db:migrate && pnpm db:seed` first). It temporarily inserts a
 * clearly-labelled private-lesson test product to prove product isolation,
 * and removes it afterwards.
 */
import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { eq } from 'drizzle-orm';
import { AppModule } from '../src/app.module';
import { Database, DRIZZLE } from '../src/database/database.module';
import { businesses, dataQualityIssues, offers, products } from '../src/database/schema';
import { CHECKOUT_URL } from '../src/database/seed/vsa-annual-ballet.data';
import { configureApp } from '../src/main';

const ANNUAL = '1-year-online-ballet-club';
const TEST_PRIVATE = 'e2e-test-private-ballet-lesson';

describe('Commerce API (e2e)', () => {
  let app: INestApplication;
  let base: string;
  let db: Database;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const get = async (path: string): Promise<{ status: number; body: any }> => {
    const res = await fetch(`${base}${path}`);
    return { status: res.status, body: await res.json() };
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.listen(0);
    base = await app.getUrl();
    base = base.replace('[::1]', 'localhost');
    db = app.get(DRIZZLE);

    const [vsa] = await db.select().from(businesses).where(eq(businesses.slug, 'victory-skating-academy'));
    await db.delete(products).where(eq(products.slug, TEST_PRIVATE));
    const [p] = await db
      .insert(products)
      .values({ businessId: vsa.id, slug: TEST_PRIVATE, name: 'E2E TEST Private Ballet Lesson', productType: 'PRIVATE_LESSON', deliveryMode: 'ONLINE_LIVE', discipline: 'BALLET', status: 'ACTIVE' })
      .returning();
    await db.insert(offers).values({ productId: p.id, label: 'E2E test offer', amountMinor: 1234, currency: 'USD', pricingBasis: 'PER_CLASS', verificationStatus: 'UNCONFIRMED' });
    await db.insert(dataQualityIssues).values({ businessId: vsa.id, productId: p.id, fieldPath: 'e2e.test', issueType: 'UNVERIFIED', explanation: 'E2E test issue' });
  });

  afterAll(async () => {
    await db.delete(products).where(eq(products.slug, TEST_PRIVATE));
    await app.close();
  });

  describe('business alias resolution', () => {
    it.each([
      ['victory-skating-academy', 'SLUG'],
      ['Victory%20Skating%20Academy', 'CANONICAL_NAME'],
      ['Victory%20Skating', 'ALIAS'],
      ['victory-skating', 'ALIAS'],
      ['VSA', 'ALIAS'],
      ['vsa', 'ALIAS'],
    ])('/businesses/%s resolves via %s', async (id, matchedBy) => {
      const { status, body } = await get(`/businesses/${id}`);
      expect(status).toBe(200);
      expect(body.slug).toBe('victory-skating-academy');
      expect(body.resolution.matchedBy).toBe(matchedBy);
    });

    it('product search by alias resolves the business', async () => {
      const { body } = await get('/products?business=VSA&discipline=ballet&deliveryMode=online_live&level=beginner&durationMonths=12');
      expect(body.businessResolution).toMatchObject({ matchedBusinessSlug: 'victory-skating-academy', matchedBy: 'ALIAS' });
      expect(body.items.map((i: { slug: string }) => i.slug)).toEqual([ANNUAL]);
    });

    it('unknown brand returns no products and says it did not resolve', async () => {
      const { status, body } = await get('/products?business=Victory%20Dance');
      expect(status).toBe(200);
      expect(body.items).toEqual([]);
      expect(body.businessResolution.matchedBusinessSlug).toBeNull();
    });
  });

  describe('product separation', () => {
    it('lists both products for VSA, but facet filters keep the annual program distinct', async () => {
      const all = await get('/products?business=VSA');
      expect(all.body.items.map((i: { slug: string }) => i.slug).sort()).toEqual([ANNUAL, TEST_PRIVATE].sort());
      const annual = await get('/products?business=VSA&durationMonths=12');
      expect(annual.body.items.map((i: { slug: string }) => i.slug)).toEqual([ANNUAL]);
    });

    it('the annual program shows only its own offer, issues and schedule', async () => {
      const detail = await get(`/products/${ANNUAL}`);
      expect(detail.body.offers).toHaveLength(1);
      expect(detail.body.offers[0].price).toEqual({ amountMinor: 49900, currency: 'USD', display: '$499.00' });
      expect(detail.body.openDataQualityIssues).toBe(5);
      const dq = await get(`/products/${ANNUAL}/data-quality`);
      expect(dq.body.issues.map((i: { fieldPath: string }) => i.fieldPath)).not.toContain('e2e.test');
    });

    it('the private-lesson product does not inherit the annual schedule, enrollment or access policy', async () => {
      expect((await get(`/products/${TEST_PRIVATE}/schedule`)).status).toBe(404);
      const enrollment = await get(`/products/${TEST_PRIVATE}/enrollment`);
      expect(enrollment.body.status).toBe('UNKNOWN');
      const detail = await get(`/products/${TEST_PRIVATE}`);
      expect(detail.body.accessPolicy).toBeNull();
      expect(detail.body.program).toBeNull();
      expect(detail.body.offers.map((o: { label: string }) => o.label)).toEqual(['E2E test offer']);
    });
  });

  describe('date-check and schedule', () => {
    it('answers the 2026-11-06 question with separate sections', async () => {
      const { status, body } = await get(`/products/${ANNUAL}/date-check?date=2026-11-06`);
      expect(status).toBe(200);
      expect(body).not.toHaveProperty('available');
      expect(body.enrollment).toMatchObject({ status: 'OPEN', provenance: { sourceType: 'PROTOTYPE_CONFIG', verificationStatus: 'UNCONFIRMED' } });
      expect(body.requestedDate).toMatchObject({ date: '2026-11-06', weekday: 'FRIDAY', matchesRecurrence: false });
      expect(body.nextCandidateOccurrences[0]).toMatchObject({ scheduleLocalDate: '2026-11-07', startsAtUtc: '2026-11-07T19:00:00Z', status: 'CANDIDATE_UNCONFIRMED' });
      expect(body.schedule.exceptions.knowledge.status).toBe('NOT_PROVIDED');
    });

    it('checkout is captured but blocked by the price conflict, with the URL withheld', async () => {
      const { body } = await get(`/products/${ANNUAL}/checkout`);
      expect(body.actions[0]).toMatchObject({
        type: 'EXTERNAL_CHECKOUT',
        provider: 'STRIPE',
        urlCaptured: true,
        url: null,
        urlWithheld: true,
        usable: false,
        blockingIssues: [{ code: 'PRICE_CONFLICT' }],
        verification: { sourceType: 'MANUAL_CHECKOUT_VERIFICATION', verificationStatus: 'CONFLICTING' },
        offer: { amountMinor: 49900, currency: 'USD' },
        observedTerms: { amountMinor: 17900, currency: 'USD', billing: 'ANNUAL', observedAt: '2026-10-03', isAuthoritativeOffer: false },
      });
    });

    it('data-quality includes the OPEN checkout price conflict with source evidence and a DERIVED comparison only', async () => {
      const { body } = await get(`/products/${ANNUAL}/data-quality`);
      const issue = body.issues.find((i: { fieldPath: string }) => i.fieldPath === 'checkout.price');
      expect(issue).toMatchObject({
        issueType: 'CONFLICTING',
        status: 'OPEN',
        blocksCheckout: 'PRICE_CONFLICT',
        claimSource: { sourceType: 'MANUAL_CHECKOUT_VERIFICATION' },
        evidence: {
          authoritativeOffer: { amountMinor: 49900, sourceType: 'ASSIGNMENT_BRIEF' },
          observedCheckout: { amountMinor: 17900, billing: 'ANNUAL', sourceType: 'MANUAL_CHECKOUT_VERIFICATION' },
          comparison: { sourceType: 'DERIVED', isPublishedFact: false, value: { amountsMatch: false, resolution: 'UNRESOLVED' } },
        },
      });
      expect(body.issues.find((i: { fieldPath: string }) => i.fieldPath === 'checkout.externalUrl')).toMatchObject({ status: 'RESOLVED', blocksCheckout: null });
      expect(body.summary.open).toBe(5);
    });

    it('no public endpoint exposes the blocked checkout URL', async () => {
      for (const path of ['', '/checkout', '/data-quality', '/schedule', '/enrollment', '/date-check?date=2026-11-06']) {
        const json = JSON.stringify((await get(`/products/${ANNUAL}${path}`)).body);
        expect(json).not.toContain(CHECKOUT_URL);
        expect(json).not.toContain('buy.stripe.com');
      }
    });
  });

  describe('errors', () => {
    it.each([
      ['/products/does-not-exist', 404],
      ['/products/does-not-exist/schedule', 404],
      ['/businesses/nobody-at-all', 404],
      [`/products/${ANNUAL}/date-check`, 400],
      [`/products/${ANNUAL}/date-check?date=2026-13-01`, 400],
      [`/products/${ANNUAL}/date-check?date=2026-11-06&tz=Not/AZone`, 400],
      [`/products/${ANNUAL}/schedule?tz=PDT`, 400],
      ['/products?level=EXPERT', 400],
      ['/products?discipline=hockey', 400],
      ['/products?durationMonths=0', 400],
      [`/products/${ANNUAL}/enrollment?unexpected=1`, 400],
    ])('%s -> %d', async (path, expected) => {
      expect((await get(path)).status).toBe(expected);
    });
  });
});
