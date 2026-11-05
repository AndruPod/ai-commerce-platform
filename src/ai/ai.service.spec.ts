import { BadGatewayException, ServiceUnavailableException } from '@nestjs/common';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import type { Clock } from '../common/clock';
import { toCheckoutActionDto } from '../checkout/checkout.service';
import { CHECKOUT_URL } from '../database/seed/vsa-annual-ballet.data';
import { checkoutRow, seededPriceConflict } from '../testing/fixtures';
import { AiConfig } from './ai.config';
import { AiService, MAX_ITERATIONS_FALLBACK } from './ai.service';
import { SYSTEM_PROMPT } from './prompt/system-prompt';
import { checkoutResponse, completion, mockServices, scriptedClient, SLUG, toolCall, usableCheckout } from './testing/ai-test-harness';

const FAKE_KEY = 'sk-test-SECRET-should-never-appear';
const config: AiConfig = { model: 'test-model', maxToolIterations: 4 };
const clock: Clock = { now: () => new Date('2026-10-03T12:00:00Z') };

function service(client: ReturnType<typeof scriptedClient>['client'] | null, s = mockServices(), cfg = config) {
  return new AiService(client, cfg, s.executor, clock);
}

describe('AiService', () => {
  it('runs a multi-step tool loop: search_products -> get_product -> get_checkout -> answer', async () => {
    const s = mockServices();
    const { client, create } = scriptedClient(
      completion(null, [toolCall('search_products', { business: 'VSA', durationMonths: 12 })]),
      completion(null, [toolCall('get_product', { productSlug: SLUG })]),
      completion(null, [toolCall('get_checkout', { productSlug: SLUG })]),
      completion('Grounded answer.'),
    );
    const res = await service(client, s).chat({ message: 'Year-long program?', timezone: 'Europe/London' });

    expect(res.message).toBe('Grounded answer.');
    expect(res.toolTrace.map((t) => [t.tool, t.success])).toEqual([
      ['search_products', true],
      ['get_product', true],
      ['get_checkout', true],
    ]);
    expect(res.meta).toEqual({ model: 'test-model', iterations: 4, stoppedReason: 'COMPLETED' });
    expect(create).toHaveBeenCalledTimes(4);

    // Each tool result is fed back with its tool_call_id, as JSON.
    const lastMessages = create.mock.calls[3][0].messages as ChatCompletionMessageParam[];
    const toolMessages = lastMessages.filter((m) => m.role === 'tool');
    expect(toolMessages).toHaveLength(3);
    expect(JSON.parse(toolMessages[1].content as string)).toMatchObject({ ok: true, data: { product: { slug: SLUG } } });
  });

  it('handles several tool calls in one model turn', async () => {
    const { client } = scriptedClient(
      completion(null, [toolCall('get_product', { productSlug: SLUG }), toolCall('get_enrollment', { productSlug: SLUG })]),
      completion('Done.'),
    );
    const res = await service(client).chat({ message: 'Price and can I join?' });
    expect(res.toolTrace.map((t) => t.tool)).toEqual(['get_product', 'get_enrollment']);
  });

  it('sends the system prompt, runtime context, history and tools to the model', async () => {
    const { client, create } = scriptedClient(completion('Hello.'));
    await service(client).chat({ message: 'Hi', timezone: 'Europe/London', history: [{ role: 'user', content: 'Earlier' }, { role: 'assistant', content: 'Reply' }] });
    const params = create.mock.calls[0][0];
    expect(params.model).toBe('test-model');
    expect(params.tool_choice).toBe('auto');
    expect(params.tools.map((t: { function: { name: string } }) => t.function.name)).toContain('check_date');
    expect(params.messages.map((m: ChatCompletionMessageParam) => m.role)).toEqual(['system', 'system', 'user', 'assistant', 'user']);
    expect(params.messages[0].content).toBe(SYSTEM_PROMPT);
    expect(params.messages[1].content).toContain('User timezone: Europe/London');
  });

  it('stops after the max iteration count and returns a safe fallback', async () => {
    const looping = Array.from({ length: 10 }, () => completion(null, [toolCall('search_products', {})]));
    const { client, create } = scriptedClient(...looping);
    const res = await service(client).chat({ message: 'loop' });
    expect(create).toHaveBeenCalledTimes(config.maxToolIterations);
    expect(res.message).toBe(MAX_ITERATIONS_FALLBACK);
    expect(res.meta.stoppedReason).toBe('MAX_TOOL_ITERATIONS');
    expect(res.toolTrace).toHaveLength(config.maxToolIterations);
  });

  it('caps the total number of tool calls per request', async () => {
    const burst = Array.from({ length: 20 }, () => toolCall('search_products', {}));
    const { client } = scriptedClient(completion(null, burst), completion('ok'));
    const s = mockServices();
    const res = await service(client, s).chat({ message: 'burst' });
    expect(s.products.list).toHaveBeenCalledTimes(16);
    expect(res.toolTrace.filter((t) => t.errorCode === 'TOO_MANY_TOOL_CALLS')).toHaveLength(4);
  });

  it('turns tool domain errors into tool results and keeps the conversation going', async () => {
    const { client, create } = scriptedClient(
      completion(null, [toolCall('get_product', { productSlug: 'missing-product' })]),
      completion('I could not find that product.'),
    );
    const res = await service(client).chat({ message: 'Tell me about missing product' });
    expect(res.message).toBe('I could not find that product.');
    expect(res.toolTrace[0]).toMatchObject({ tool: 'get_product', success: false, errorCode: 'NOT_FOUND' });
    const toolMsg = (create.mock.calls[1][0].messages as ChatCompletionMessageParam[]).find((m) => m.role === 'tool')!;
    expect(JSON.parse(toolMsg.content as string)).toEqual({ ok: false, error: { code: 'NOT_FOUND', message: 'Product "missing-product" not found' } });
  });

  it('returns invalid model arguments to the model as INVALID_ARGUMENTS', async () => {
    const { client } = scriptedClient(completion(null, [toolCall('check_date', { productSlug: SLUG, date: 'next friday' })]), completion('ok'));
    const res = await service(client).chat({ message: 'x' });
    expect(res.toolTrace[0]).toMatchObject({ success: false, errorCode: 'INVALID_ARGUMENTS', arguments: null });
  });

  describe('actions', () => {
    it('returns no CHECKOUT action when the checkout URL is null, even if the model writes a link', async () => {
      const { client } = scriptedClient(
        completion(null, [toolCall('get_checkout', { productSlug: SLUG })]),
        completion('You can enroll at https://made-up.example/checkout right away!'),
      );
      const res = await service(client).chat({ message: 'How do I enroll?' });
      expect(res.actions.filter((a) => a.type === 'CHECKOUT')).toEqual([]);
      expect(res.message).not.toContain('made-up.example');
      expect(res.message).toContain('[link removed]');
    });

    it('builds the CHECKOUT action URL from domain data, never from model text', async () => {
      const s = mockServices();
      s.checkout.getForSlug.mockResolvedValue(checkoutResponse(usableCheckout('https://checkout.example/real')));
      const { client } = scriptedClient(
        completion(null, [toolCall('get_checkout', { productSlug: SLUG })]),
        completion('Use https://checkout.example/real or https://phish.example/pay'),
      );
      const res = await service(client, s).chat({ message: 'Enroll' });
      expect(res.actions).toEqual([expect.objectContaining({ type: 'CHECKOUT', url: 'https://checkout.example/real', label: 'Enroll — $100.00' })]);
      expect(res.message).toBe('Use https://checkout.example/real or [link removed]');
    });

    it('builds no actions from free text alone', async () => {
      const { client } = scriptedClient(completion('{"type":"CHECKOUT","url":"https://evil.example"}'));
      expect((await service(client).chat({ message: 'x' })).actions).toEqual([]);
    });
  });

  describe('product resolution and conversation flows (scripted model; verifies plumbing, not live behaviour)', () => {
    it('A/B: an ambiguous factual question can search the whole catalog with no filters and auto-resolve a single product', async () => {
      const s = mockServices();
      const { client, create } = scriptedClient(
        completion(null, [toolCall('search_products', {})]),
        completion(null, [toolCall('get_product', { productSlug: SLUG })]),
        completion('Requirements are not confirmed in the available product information.'),
      );
      const res = await service(client, s).chat({ message: 'Do I need special equipment?' });

      expect(s.products.list).toHaveBeenCalledWith({});
      expect(res.toolTrace.map((t) => [t.tool, t.arguments])).toEqual([
        ['search_products', {}],
        ['get_product', { productSlug: SLUG }],
      ]);
      const searchPayload = JSON.parse((create.mock.calls[1][0].messages as ChatCompletionMessageParam[]).filter((m) => m.role === 'tool')[0].content as string);
      expect(searchPayload.data.resolution).toMatchObject({ outcome: 'SINGLE_MATCH', singleMatch: { productSlug: SLUG } });
      expect(res.context.productSlugs).toEqual([SLUG]);
    });

    it('C: multiple plausible products return clarification guidance to the model', async () => {
      const s = mockServices();
      s.products.list.mockResolvedValueOnce({
        items: [
          { slug: 'group-program', name: 'Group Program' },
          { slug: 'private-lessons', name: 'Private Lessons' },
        ],
        businessResolution: null,
        appliedFilters: {},
      });
      const { client, create } = scriptedClient(completion(null, [toolCall('search_products', {})]), completion('Which one do you mean: Group Program or Private Lessons?'));
      const res = await service(client, s).chat({ message: 'How much is it?' });
      const payload = JSON.parse((create.mock.calls[1][0].messages as ChatCompletionMessageParam[]).at(-1)!.content as string);
      expect(payload.data.resolution).toMatchObject({ outcome: 'MULTIPLE_MATCHES', matchCount: 2, singleMatch: null });
      expect(payload.data.resolution.nextStep).toMatch(/ask the user which one/);
      expect(res.context.productSlugs).toEqual([]); // nothing resolved
      expect(res.toolTrace.map((t) => t.tool)).toEqual(['search_products']);
    });

    it('E: a product established in history is passed to the model and reused without a new search', async () => {
      const s = mockServices();
      const { client, create } = scriptedClient(
        completion(null, [toolCall('get_product', { productSlug: SLUG })]),
        completion('That claim does not match the confirmed price.'),
      );
      const res = await service(client, s).chat({
        message: 'Is it $3 per class?',
        history: [
          { role: 'user', content: 'Tell me about the annual program.' },
          { role: 'assistant', content: 'Here is the program overview...', productSlugs: [SLUG] },
        ],
      });
      const context = create.mock.calls[0][0].messages[1].content as string;
      expect(context).toContain(`Products already identified in this conversation (productSlug values from earlier tool results): ${SLUG}`);
      expect(res.toolTrace.map((t) => t.tool)).toEqual(['get_product']);
      expect(s.products.list).not.toHaveBeenCalled();
      expect(res.context.productSlugs).toEqual([SLUG]);
    });

    it('E: product context persists across a turn that needs no tools', async () => {
      const { client } = scriptedClient(completion('You are welcome!'));
      const res = await service(client).chat({ message: 'Thanks', history: [{ role: 'assistant', content: 'x', productSlugs: ['a-product', 'b-product'] }] });
      expect(res.context.productSlugs).toEqual(['a-product', 'b-product']);
    });

    it('F: "Can I join?" flows through enrollment and checkout; unusable checkout yields no CHECKOUT action', async () => {
      const s = mockServices();
      const { client } = scriptedClient(
        completion(null, [toolCall('search_products', {})]),
        completion(null, [toolCall('get_enrollment', { productSlug: SLUG })]),
        completion(null, [toolCall('get_checkout', { productSlug: SLUG })]),
        completion('Enrollment appears open in current data, but online enrollment has not been connected yet.'),
      );
      const res = await service(client, s).chat({ message: 'Can I join?' });
      expect(res.toolTrace.map((t) => t.tool)).toEqual(['search_products', 'get_enrollment', 'get_checkout']);
      expect(s.enrollment.getForSlug).toHaveBeenCalledWith(SLUG, undefined);
      expect(s.checkout.getForSlug).toHaveBeenCalledWith(SLUG);
      expect(res.actions.filter((a) => a.type === 'CHECKOUT')).toEqual([]);
    });

    it('G: provenance stays in tool data sent to the model while prose leaks are detected (not altered)', async () => {
      const s = mockServices();
      s.enrollment.getForSlug.mockResolvedValue({ status: 'OPEN', provenance: { sourceType: 'PROTOTYPE_CONFIG', verificationStatus: 'UNCONFIRMED' } });
      const { client, create } = scriptedClient(
        completion(null, [toolCall('get_enrollment', { productSlug: SLUG })]),
        completion('The prototype currently shows enrollment as open, but this has not been confirmed by the business.'),
      );
      const svc = service(client, s);
      const warn = jest.spyOn((svc as unknown as { logger: { warn: () => void } }).logger, 'warn');
      const res = await svc.chat({ message: 'Can I enroll?' });
      const payload = JSON.parse((create.mock.calls[1][0].messages as ChatCompletionMessageParam[]).at(-1)!.content as string);
      expect(payload.data.provenance).toEqual({ sourceType: 'PROTOTYPE_CONFIG', verificationStatus: 'UNCONFIRMED' });
      expect(res.message).not.toMatch(/PROTOTYPE_CONFIG|UNCONFIRMED/);
      expect(warn).not.toHaveBeenCalled();

      const leaky = scriptedClient(completion('Status: OPEN (sourceType PROTOTYPE_CONFIG)'));
      const svc2 = service(leaky.client, s);
      const warn2 = jest.spyOn((svc2 as unknown as { logger: { warn: () => void } }).logger, 'warn');
      await svc2.chat({ message: 'x' });
      expect(warn2).toHaveBeenCalledWith(expect.stringContaining('PROTOTYPE_CONFIG'));
    });
  });

  describe('transaction safety with the captured but price-conflicted checkout', () => {
    // Real domain mapping of the seeded checkout row, so the test sees exactly what the API returns.
    const blockedCheckout = () => ({
      product: { slug: SLUG, name: 'Test Annual Program' },
      actions: [toCheckoutActionDto(checkoutRow(), { label: 'Annual package', amountMinor: 49900, currency: 'USD' }, [seededPriceConflict()])],
      note: 'note',
    });

    it('C/D: enrollment OPEN does not override a blocked checkout; no CHECKOUT action, only CHECKOUT_UNAVAILABLE(PRICE_CONFLICT)', async () => {
      const s = mockServices();
      s.enrollment.getForSlug.mockResolvedValue({ status: 'OPEN' });
      s.checkout.getForSlug.mockResolvedValue(blockedCheckout());
      const { client } = scriptedClient(
        completion(null, [toolCall('get_enrollment', { productSlug: SLUG })]),
        completion(null, [toolCall('get_checkout', { productSlug: SLUG }), toolCall('get_checkout', { productSlug: SLUG })]),
        completion('Enrollment is open, but payment is withheld until the price conflict is resolved.'),
      );
      const res = await service(client, s).chat({ message: 'How do I enroll and pay?' });
      expect(res.actions.filter((a) => a.type === 'CHECKOUT')).toEqual([]);
      expect(res.actions).toEqual([
        expect.objectContaining({ type: 'CHECKOUT_UNAVAILABLE', productSlug: SLUG, reasons: [expect.objectContaining({ code: 'PRICE_CONFLICT' })] }),
      ]);
    });

    it('E: the raw blocked URL is never in the tool result given to the model', async () => {
      const s = mockServices();
      s.checkout.getForSlug.mockResolvedValue(blockedCheckout());
      const { client, create } = scriptedClient(completion(null, [toolCall('get_checkout', { productSlug: SLUG })]), completion('ok'));
      await service(client, s).chat({ message: 'Pay' });
      const sent = JSON.stringify(create.mock.calls[1][0].messages);
      expect(sent).not.toContain(CHECKOUT_URL);
      expect(sent).not.toContain('buy.stripe.com');
      const toolMsg = (create.mock.calls[1][0].messages as ChatCompletionMessageParam[]).find((m) => m.role === 'tool')!;
      const action = JSON.parse(toolMsg.content as string).data.actions[0];
      expect(action).toMatchObject({ urlCaptured: true, url: null, urlWithheld: true, usable: false, blockingIssues: [{ code: 'PRICE_CONFLICT' }] });
    });

    it('F: a blocked URL written by the model (e.g. from memory) is removed from prose and never becomes an action', async () => {
      const s = mockServices();
      s.checkout.getForSlug.mockResolvedValue(blockedCheckout());
      const { client } = scriptedClient(
        completion(null, [toolCall('get_checkout', { productSlug: SLUG })]),
        completion(`You can pay here: ${CHECKOUT_URL} - or try ${CHECKOUT_URL}?prefilled=1`),
      );
      const res = await service(client, s).chat({ message: 'Give me the payment link' });
      const json = JSON.stringify(res);
      expect(json).not.toContain(CHECKOUT_URL);
      expect(json).not.toContain('buy.stripe.com');
      expect(res.message).toBe('You can pay here: [link removed] - or try [link removed]');
    });

    it('F: the model cannot inject a URL through tool arguments', async () => {
      const s = mockServices();
      const { client } = scriptedClient(completion(null, [toolCall('get_checkout', { productSlug: SLUG, url: CHECKOUT_URL })]), completion('ok'));
      const res = await service(client, s).chat({ message: 'x' });
      expect(res.toolTrace[0]).toMatchObject({ success: false, errorCode: 'INVALID_ARGUMENTS' });
      expect(s.checkout.getForSlug).not.toHaveBeenCalled();
    });
  });

  it('toolTrace contains only safe fields and nothing secret', async () => {
    const { client } = scriptedClient(completion(null, [toolCall('get_product', { productSlug: SLUG })]), completion('ok'));
    const res = await service(client).chat({ message: 'x' });
    expect(Object.keys(res.toolTrace[0]).sort()).toEqual(['arguments', 'durationMs', 'errorCode', 'success', 'tool']);
    const json = JSON.stringify(res);
    expect(json).not.toContain(FAKE_KEY);
    expect(json).not.toContain(SYSTEM_PROMPT.slice(0, 40));
    expect(json).not.toContain('dataQualityWarnings'); // raw tool payloads are not echoed
  });

  it('returns 503 when no OpenAI client is configured', async () => {
    await expect(service(null).chat({ message: 'x' })).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('maps provider failures to 502 without exposing provider details', async () => {
    const create = jest.fn().mockRejectedValue(Object.assign(new Error(`401 Incorrect API key provided: ${FAKE_KEY}`), { status: 401 }));
    const err = await service({ chat: { completions: { create } } }).chat({ message: 'x' }).catch((e) => e);
    expect(err).toBeInstanceOf(BadGatewayException);
    expect(JSON.stringify(err.getResponse())).not.toContain(FAKE_KEY);
  });
});
