import { ApiError, createApiClient } from './client';

const json = (status: number, body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));

describe('createApiClient', () => {
  it('posts chat requests to the configured base URL', async () => {
    const fetchImpl = vi.fn().mockReturnValue(json(200, { message: 'hi', actions: [], toolTrace: [], context: { productSlugs: [] }, meta: {} }));
    const api = createApiClient('http://api.test/', fetchImpl);
    await api.chat({ message: 'x', history: [] });
    expect(fetchImpl).toHaveBeenCalledWith('http://api.test/ai/chat', expect.objectContaining({ method: 'POST', body: JSON.stringify({ message: 'x', history: [] }) }));
  });

  it.each([
    [400, { message: ['timezone must be a valid IANA timezone'] }, 'BAD_REQUEST', /rejected: timezone must be a valid IANA timezone/],
    [502, { message: 'The AI provider request failed.' }, 'AI_PROVIDER', /AI provider did not respond/],
    [503, { message: 'not configured' }, 'AI_UNAVAILABLE', /currently unavailable/],
    [500, {}, 'UNEXPECTED', /HTTP 500/],
  ])('maps HTTP %i to %s', async (status, body, kind, msg) => {
    const api = createApiClient('http://api.test', vi.fn().mockReturnValue(json(status, body)));
    const err = await api.chat({ message: 'x' }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.kind).toBe(kind);
    expect(err.message).toMatch(msg);
  });

  it('maps network failures', async () => {
    const api = createApiClient('http://api.test', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(api.chat({ message: 'x' })).rejects.toMatchObject({ kind: 'NETWORK', message: expect.stringMatching(/Can't reach the commerce API at http:\/\/api.test/) });
  });

  it('rejects malformed chat payloads', async () => {
    const api = createApiClient('http://api.test', vi.fn().mockReturnValue(json(200, { nope: true })));
    await expect(api.chat({ message: 'x' })).rejects.toMatchObject({ kind: 'UNEXPECTED' });
  });
});
