// Test-only helpers: mocked commerce services and a scripted OpenAI client.
import { NotFoundException } from '@nestjs/common';
import type { ChatCompletion, ChatCompletionMessageToolCall } from 'openai/resources/chat/completions';
import type { DateCheckService } from '../../availability/date-check.service';
import type { CheckoutService } from '../../checkout/checkout.service';
import type { CheckoutResponseDto } from '../../checkout/dto/checkout.response';
import type { DataQualityService } from '../../data-quality/data-quality.service';
import type { EnrollmentService } from '../../enrollment/enrollment.service';
import type { ProductService } from '../../product/product.service';
import type { ScheduleService } from '../../schedule/schedule.service';
import type { ChatClient } from '../ai.config';
import { CheckDateTool } from '../tools/check-date.tool';
import { GetCheckoutTool } from '../tools/get-checkout.tool';
import { GetEnrollmentTool } from '../tools/get-enrollment.tool';
import { GetProductTool } from '../tools/get-product.tool';
import { SearchProductsTool } from '../tools/search-products.tool';
import { ToolExecutor } from '../tools/tool-executor';

export const SLUG = 'test-annual-program';

export function checkoutResponse(overrides: Partial<CheckoutResponseDto['actions'][number]> = {}): CheckoutResponseDto {
  return {
    product: { slug: SLUG, name: 'Test Annual Program' },
    actions: [
      {
        type: 'EXTERNAL_CHECKOUT',
        provider: 'OTHER',
        systemOfRecord: 'External checkout',
        status: 'NOT_CAPTURED',
        urlCaptured: false,
        url: null,
        urlWithheld: false,
        usable: false,
        blockingIssues: [{ code: 'URL_NOT_CAPTURED', message: 'The checkout URL has not been captured yet.' }],
        verification: { sourceType: null, sourceRef: null, verificationStatus: 'UNKNOWN', verifiedAt: null },
        offer: { label: 'Package', amountMinor: 10000, currency: 'USD', display: '$100.00' },
        observedTerms: null,
        ...overrides,
      },
    ],
    note: 'note',
  };
}

/** A usable checkout as the domain would return it once nothing blocks it. */
export function usableCheckout(url = 'https://checkout.example/real'): Partial<CheckoutResponseDto['actions'][number]> {
  return { status: 'ACTIVE', urlCaptured: true, url, urlWithheld: false, usable: true, blockingIssues: [] };
}

export function mockServices() {
  const products = {
    list: jest.fn().mockResolvedValue({ items: [{ slug: SLUG, name: 'Test Annual Program' }], businessResolution: null, appliedFilters: {} }),
    detail: jest.fn().mockImplementation(async (slug: string) => {
      if (slug !== SLUG) throw new NotFoundException(`Product "${slug}" not found`);
      return { slug: SLUG, name: 'Test Annual Program', links: { checkout: `/products/${SLUG}/checkout` } };
    }),
  };
  const schedule = {
    getForSlug: jest.fn().mockResolvedValue({
      product: { slug: SLUG, name: 'Test Annual Program' },
      recurrence: { frequency: 'WEEKLY', provenance: { verificationStatus: 'CONFIRMED' } },
      exceptions: { knowledge: { status: 'NOT_PROVIDED' }, items: [] },
      requestedDate: null,
      nextCandidateOccurrences: [{ scheduleLocalDate: '2026-10-10' }],
      computation: { computable: true },
    }),
  };
  const dataQuality = {
    getForSlug: jest.fn().mockResolvedValue({
      note: 'not authoritative',
      issues: [
        { fieldPath: 'offer.pricePerClass', rawClaim: 'claim', issueType: 'CONFLICTING', status: 'OPEN' },
        { fieldPath: 'old', rawClaim: 'old', issueType: 'OUTDATED', status: 'RESOLVED' },
      ],
    }),
  };
  const dateCheck = { check: jest.fn().mockResolvedValue({ requestedDate: { matchesRecurrence: false } }) };
  const enrollment = { getForSlug: jest.fn().mockResolvedValue({ status: 'OPEN' }) };
  const checkout = { getForSlug: jest.fn().mockResolvedValue(checkoutResponse()) };

  const executor = new ToolExecutor(
    new SearchProductsTool(products as unknown as ProductService),
    new GetProductTool(products as unknown as ProductService, dataQuality as unknown as DataQualityService, schedule as unknown as ScheduleService),
    new CheckDateTool(dateCheck as unknown as DateCheckService),
    new GetEnrollmentTool(enrollment as unknown as EnrollmentService),
    new GetCheckoutTool(checkout as unknown as CheckoutService),
  );
  return { products, dataQuality, schedule, dateCheck, enrollment, checkout, executor };
}

let callSeq = 0;
export function toolCall(name: string, args: object | string): ChatCompletionMessageToolCall {
  return {
    id: `call_${++callSeq}`,
    type: 'function',
    function: { name, arguments: typeof args === 'string' ? args : JSON.stringify(args) },
  };
}

export function completion(content: string | null, toolCalls?: ChatCompletionMessageToolCall[]): ChatCompletion {
  return {
    id: 'cmpl',
    object: 'chat.completion',
    created: 0,
    model: 'test-model',
    choices: [
      {
        index: 0,
        finish_reason: toolCalls ? 'tool_calls' : 'stop',
        logprobs: null,
        message: { role: 'assistant', content, refusal: null, ...(toolCalls ? { tool_calls: toolCalls } : {}) },
      },
    ],
  };
}

/** A fake OpenAI client that returns the scripted completions in order. */
export function scriptedClient(...responses: ChatCompletion[]) {
  const create = jest.fn();
  for (const r of responses) create.mockResolvedValueOnce(r);
  return { client: { chat: { completions: { create } } } as ChatClient, create };
}
