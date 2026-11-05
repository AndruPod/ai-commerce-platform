import type {
  ChatRequest,
  ChatResponse,
  CheckoutResponse,
  DateCheckResponse,
  EnrollmentView,
  ProductDetail,
  ScheduleResponse,
} from './types';

export type ApiErrorKind = 'NETWORK' | 'BAD_REQUEST' | 'NOT_FOUND' | 'AI_PROVIDER' | 'AI_UNAVAILABLE' | 'UNEXPECTED';

/** Normalised API failure with a customer-presentable message. */
export class ApiError extends Error {
  constructor(
    readonly kind: ApiErrorKind,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface CommerceApi {
  baseUrl: string;
  ping(): Promise<boolean>;
  chat(req: ChatRequest): Promise<ChatResponse>;
  getProduct(slug: string): Promise<ProductDetail>;
  getSchedule(slug: string, tz?: string): Promise<ScheduleResponse>;
  getEnrollment(slug: string): Promise<EnrollmentView>;
  getCheckout(slug: string): Promise<CheckoutResponse>;
  dateCheck(slug: string, date: string, tz?: string): Promise<DateCheckResponse>;
}

export const DEFAULT_API_BASE_URL = 'http://localhost:3001';

function serverMessage(body: unknown): string | null {
  if (body && typeof body === 'object' && 'message' in body) {
    const m = (body as { message: unknown }).message;
    if (Array.isArray(m)) return m.join('; ');
    if (typeof m === 'string') return m;
  }
  return null;
}

export function toApiError(status: number, body: unknown): ApiError {
  const detail = serverMessage(body);
  switch (status) {
    case 400:
      return new ApiError('BAD_REQUEST', `The request was rejected${detail ? `: ${detail}` : '.'}`, status);
    case 404:
      return new ApiError('NOT_FOUND', detail ?? 'The requested item was not found.', status);
    case 502:
      return new ApiError('AI_PROVIDER', 'The AI provider did not respond successfully. Please try again.', status);
    case 503:
      return new ApiError('AI_UNAVAILABLE', 'The AI assistant is currently unavailable on the server (it may not be configured).', status);
    default:
      return new ApiError('UNEXPECTED', `Unexpected server response (HTTP ${status}).`, status);
  }
}

export function createApiClient(baseUrl: string = process.env.NEXT_PUBLIC_API_BASE_URL || DEFAULT_API_BASE_URL, fetchImpl: typeof fetch = (...a) => fetch(...a)): CommerceApi {
  const root = baseUrl.replace(/\/+$/, '');

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    let res: Response;
    try {
      res = await fetchImpl(`${root}${path}`, { ...init, headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) } });
    } catch {
      throw new ApiError('NETWORK', `Can't reach the commerce API at ${root}. Is the backend running?`);
    }
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      if (res.ok) throw new ApiError('UNEXPECTED', 'The server returned an unreadable response.', res.status);
    }
    if (!res.ok) throw toApiError(res.status, body);
    if (body === null || typeof body !== 'object') throw new ApiError('UNEXPECTED', 'The server returned an unexpected response.', res.status);
    return body as T;
  }

  const enc = encodeURIComponent;
  const q = (params: Record<string, string | undefined>) => {
    const s = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => e[1] !== undefined)).toString();
    return s ? `?${s}` : '';
  };

  return {
    baseUrl: root,
    async ping() {
      try {
        await request('/products');
        return true;
      } catch {
        return false;
      }
    },
    async chat(req) {
      const res = await request<ChatResponse>('/ai/chat', { method: 'POST', body: JSON.stringify(req) });
      if (typeof res.message !== 'string' || !Array.isArray(res.actions) || !Array.isArray(res.toolTrace)) {
        throw new ApiError('UNEXPECTED', 'The assistant returned an unexpected response.');
      }
      return res;
    },
    getProduct: (slug) => request(`/products/${enc(slug)}`),
    getSchedule: (slug, tz) => request(`/products/${enc(slug)}/schedule${q({ tz })}`),
    getEnrollment: (slug) => request(`/products/${enc(slug)}/enrollment`),
    getCheckout: (slug) => request(`/products/${enc(slug)}/checkout`),
    dateCheck: (slug, date, tz) => request(`/products/${enc(slug)}/date-check${q({ date, tz })}`),
  };
}
