import { NotFoundException } from '@nestjs/common';
import { mockServices, SLUG } from '../testing/ai-test-harness';

const ctx = { userTimezone: null };

describe('ToolExecutor', () => {
  it('exposes exactly the five commerce tools to the model', () => {
    const { executor } = mockServices();
    expect(executor.definitions().map((d) => d.function.name)).toEqual([
      'search_products',
      'get_product',
      'check_date',
      'get_enrollment',
      'get_checkout',
    ]);
  });

  describe('dispatch', () => {
    it('search_products -> ProductService.list with validated, normalised filters', async () => {
      const s = mockServices();
      const r = await s.executor.execute('search_products', JSON.stringify({ business: 'VSA', level: 'beginner', durationMonths: 12, discipline: null }), ctx);
      expect(r.success).toBe(true);
      expect(s.products.list).toHaveBeenCalledWith(expect.objectContaining({ business: 'VSA', level: 'BEGINNER', durationMonths: 12 }));
      expect(r.arguments).toEqual({ business: 'VSA', level: 'BEGINNER', durationMonths: 12 });
    });

    it('get_product -> product (without REST links), schedule rule (without dates) and only OPEN warnings', async () => {
      const s = mockServices();
      const r = await s.executor.execute('get_product', JSON.stringify({ productSlug: SLUG }), ctx);
      expect(r.result).toEqual({
        ok: true,
        data: {
          product: { slug: SLUG, name: 'Test Annual Program' },
          schedule: {
            recurrence: { frequency: 'WEEKLY', provenance: { verificationStatus: 'CONFIRMED' } },
            exceptions: { knowledge: { status: 'NOT_PROVIDED' }, items: [] },
          },
          dataQualityWarnings: { note: 'not authoritative', issues: [expect.objectContaining({ fieldPath: 'offer.pricePerClass', status: 'OPEN' })] },
        },
      });
      expect(JSON.stringify(r.result)).not.toMatch(/links|nextCandidateOccurrences/);
    });

    it('get_product returns schedule null for a product without a schedule', async () => {
      const s = mockServices();
      s.schedule.getForSlug.mockRejectedValueOnce(new NotFoundException('No schedule'));
      const r = await s.executor.execute('get_product', JSON.stringify({ productSlug: SLUG }), ctx);
      expect(r.result).toMatchObject({ ok: true, data: { schedule: null } });
    });

    it('check_date -> DateCheckService.check, defaulting timezone to the user timezone', async () => {
      const s = mockServices();
      await s.executor.execute('check_date', JSON.stringify({ productSlug: SLUG, date: '2026-11-06' }), { userTimezone: 'Europe/London' });
      expect(s.dateCheck.check).toHaveBeenCalledWith(SLUG, '2026-11-06', 'Europe/London');
    });

    it('check_date keeps an explicit timezone from the model', async () => {
      const s = mockServices();
      await s.executor.execute('check_date', JSON.stringify({ productSlug: SLUG, date: '2026-11-06', timezone: 'Asia/Tokyo' }), { userTimezone: 'Europe/London' });
      expect(s.dateCheck.check).toHaveBeenCalledWith(SLUG, '2026-11-06', 'Asia/Tokyo');
    });

    it('get_enrollment and get_checkout dispatch to their services', async () => {
      const s = mockServices();
      await s.executor.execute('get_enrollment', JSON.stringify({ productSlug: SLUG, date: '2026-11-06' }), ctx);
      await s.executor.execute('get_checkout', JSON.stringify({ productSlug: SLUG }), ctx);
      expect(s.enrollment.getForSlug).toHaveBeenCalledWith(SLUG, '2026-11-06');
      expect(s.checkout.getForSlug).toHaveBeenCalledWith(SLUG);
    });
  });

  describe('invalid arguments are rejected before any service call', () => {
    it.each([
      ['malformed JSON', 'get_product', '{"productSlug":'],
      ['non-object JSON', 'get_product', '"x"'],
      ['missing required slug', 'get_product', '{}'],
      ['bad slug', 'get_product', JSON.stringify({ productSlug: 'Robert"); DROP TABLE' })],
      ['unexpected property', 'get_checkout', JSON.stringify({ productSlug: SLUG, url: 'https://evil.example' })],
      ['impossible date', 'check_date', JSON.stringify({ productSlug: SLUG, date: '2026-02-30' })],
      ['invalid timezone', 'check_date', JSON.stringify({ productSlug: SLUG, date: '2026-11-06', timezone: 'PDT' })],
      ['invalid enum', 'search_products', JSON.stringify({ level: 'EXPERT' })],
    ])('%s', async (_label, tool, args) => {
      const s = mockServices();
      const r = await s.executor.execute(tool, args, ctx);
      expect(r.success).toBe(false);
      expect(r.errorCode).toBe('INVALID_ARGUMENTS');
      expect(r.arguments).toBeNull();
      for (const svc of [s.products.detail, s.products.list, s.dateCheck.check, s.checkout.getForSlug]) expect(svc).not.toHaveBeenCalled();
    });

    it('unknown tool', async () => {
      const r = await mockServices().executor.execute('delete_everything', '{}', ctx);
      expect(r.result).toEqual({ ok: false, error: { code: 'UNKNOWN_TOOL', message: 'Unknown tool "delete_everything".' } });
    });
  });

  describe('domain error conversion', () => {
    it('NotFoundException becomes a NOT_FOUND tool result instead of throwing', async () => {
      const r = await mockServices().executor.execute('get_product', JSON.stringify({ productSlug: 'no-such-product' }), ctx);
      expect(r.result).toEqual({ ok: false, error: { code: 'NOT_FOUND', message: 'Product "no-such-product" not found' } });
    });

    it('unexpected errors become TOOL_FAILED without leaking internal detail', async () => {
      const s = mockServices();
      s.checkout.getForSlug.mockRejectedValueOnce(new Error('connection to postgres://vsa:secret@db failed'));
      const r = await s.executor.execute('get_checkout', JSON.stringify({ productSlug: SLUG }), ctx);
      expect(r.errorCode).toBe('TOOL_FAILED');
      expect(JSON.stringify(r)).not.toContain('secret');
    });
  });
});
