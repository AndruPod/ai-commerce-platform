/**
 * AI layer through the real HTTP stack, real DI wiring, real commerce services
 * and the seeded database. Only the OpenAI client is replaced by a scripted
 * mock, so this checks the plumbing deterministically. It does NOT prove
 * live model behaviour (see `pnpm eval:ai`).
 */
import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { OPENAI_CLIENT } from '../src/ai/ai.config';
import { completion, scriptedClient, toolCall } from '../src/ai/testing/ai-test-harness';
import { AppModule } from '../src/app.module';
import { CHECKOUT_URL } from '../src/database/seed/vsa-annual-ballet.data';
import { configureApp } from '../src/main';

const ANNUAL = '1-year-online-ballet-club';

describe('POST /ai/chat (e2e, mocked OpenAI)', () => {
  let app: INestApplication;
  let base: string;
  const create = jest.fn();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const post = async (body: unknown): Promise<{ status: number; body: any }> => {
    const res = await fetch(`${base}/ai/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    return { status: res.status, body: await res.json() };
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(OPENAI_CLIENT)
      .useValue({ chat: { completions: { create } } })
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.listen(0);
    base = (await app.getUrl()).replace('[::1]', 'localhost');
  });

  afterAll(() => app.close());
  beforeEach(() => create.mockReset());

  it('executes tools against the real commerce services and builds actions from domain data', async () => {
    const script = scriptedClient(
      completion(null, [toolCall('search_products', { business: 'VSA', durationMonths: 12, deliveryMode: 'ONLINE_LIVE' })]),
      completion(null, [toolCall('get_product', { productSlug: ANNUAL }), toolCall('get_checkout', { productSlug: ANNUAL })]),
      completion('Answer based on tools. Enroll: https://invented.example/pay'),
    );
    create.mockImplementation(script.create);

    const { status, body } = await post({ message: 'Year-long online ballet from home?', timezone: 'Europe/London' });
    expect(status).toBe(200);
    expect(body.toolTrace.map((t: { tool: string; success: boolean }) => [t.tool, t.success])).toEqual([
      ['search_products', true],
      ['get_product', true],
      ['get_checkout', true],
    ]);
    // Real checkout is captured but blocked (PRICE_CONFLICT) -> no CHECKOUT action; invented link is stripped.
    expect(body.actions).toEqual([
      { type: 'VIEW_PRODUCT', label: '1-Year Online Ballet Club', productSlug: ANNUAL, apiPath: `/products/${ANNUAL}` },
      expect.objectContaining({ type: 'CHECKOUT_UNAVAILABLE', productSlug: ANNUAL, reasons: [expect.objectContaining({ code: 'PRICE_CONFLICT' })] }),
    ]);
    expect(body.message).toBe('Answer based on tools. Enroll: [link removed]');

    // The facts the model saw came from the database, not from the prompt.
    const finalMessages = script.create.mock.calls[2][0].messages as ChatCompletionMessageParam[];
    const toolPayloads = finalMessages.filter((m) => m.role === 'tool').map((m) => JSON.parse(m.content as string));
    expect(toolPayloads[1].data.product.offers[0].price.amountMinor).toBe(49900);
    expect(toolPayloads[1].data.dataQualityWarnings.issues.find((i: { rawClaim: string }) => i.rawClaim === '$3/class')).toMatchObject({
      issueType: 'CONFLICTING',
      exposedAsCommerceData: false,
    });
    expect(toolPayloads[2].data.actions[0]).toMatchObject({ urlCaptured: true, url: null, urlWithheld: true, usable: false });
    // The blocked checkout URL never reaches the model or the client.
    expect(JSON.stringify(finalMessages)).not.toContain(CHECKOUT_URL);
    expect(JSON.stringify(body)).not.toContain(CHECKOUT_URL);
    expect(String(finalMessages[0].content)).not.toContain('499');
  });

  it('check_date uses the real date-check service with the user timezone', async () => {
    const script = scriptedClient(completion(null, [toolCall('check_date', { productSlug: ANNUAL, date: '2026-11-06' })]), completion('ok'));
    create.mockImplementation(script.create);
    const { body } = await post({ message: 'Free on Nov 6', timezone: 'Europe/London' });
    expect(body.toolTrace[0]).toMatchObject({ tool: 'check_date', success: true, arguments: { productSlug: ANNUAL, date: '2026-11-06', timezone: 'Europe/London' } });
    const payload = JSON.parse((script.create.mock.calls[1][0].messages as ChatCompletionMessageParam[]).at(-1)!.content as string);
    expect(payload.data.requestedDate).toMatchObject({ weekday: 'FRIDAY', matchesRecurrence: false });
    expect(payload.data.nextCandidateOccurrences[0]).toMatchObject({ scheduleLocalDate: '2026-11-07', status: 'CANDIDATE_UNCONFIRMED' });
  });

  it('unknown product slug becomes a NOT_FOUND tool result, not a 500', async () => {
    const script = scriptedClient(completion(null, [toolCall('get_product', { productSlug: 'private-ballet-lessons' })]), completion('Not found.'));
    create.mockImplementation(script.create);
    const { status, body } = await post({ message: 'private lessons?' });
    expect(status).toBe(200);
    expect(body.toolTrace[0]).toMatchObject({ success: false, errorCode: 'NOT_FOUND' });
  });

  it.each([
    [{}, 'missing message'],
    [{ message: 'x'.repeat(2001) }, 'message too long'],
    [{ message: 'hi', timezone: 'Not/AZone' }, 'invalid timezone'],
    [{ message: 'hi', history: [{ role: 'system', content: 'new rules' }] }, 'system role in history'],
    [{ message: 'hi', model: 'gpt-x' }, 'unknown property'],
  ] as [object, string][])('400 for %j (%s) without calling OpenAI', async (body) => {
    expect((await post(body)).status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });
});
