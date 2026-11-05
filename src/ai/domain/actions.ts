import type { CheckoutResponseDto } from '../../checkout/dto/checkout.response';
import type { ProductDetailDto } from '../../product/dto/product.response';
import type { ToolExecution } from '../tools/tool.types';

/**
 * Machine-readable UI actions. Built only by backend code from successful
 * tool results, never from model text, so the model cannot create arbitrary
 * buttons or URLs.
 */
export type ChatAction =
  | {
      type: 'CHECKOUT';
      label: string;
      url: string;
      productSlug: string;
      offer: { label: string; amountMinor: number | null; currency: string | null; display: string | null } | null;
      systemOfRecord: string;
    }
  | { type: 'VIEW_PRODUCT'; label: string; productSlug: string; apiPath: string }
  /** Machine-readable "payment not available" with the domain's blocking reasons. Never carries a URL. */
  | { type: 'CHECKOUT_UNAVAILABLE'; label: string; productSlug: string; reasons: { code: string; message: string }[] };

export function isSafeHttpUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

export function buildActions(executions: ToolExecution[]): ChatAction[] {
  const actions = new Map<string, ChatAction>();

  for (const e of executions) {
    if (!e.result.ok) continue;

    if (e.tool === 'get_product') {
      const { product } = e.result.data as { product: ProductDetailDto };
      actions.set(`VIEW_PRODUCT:${product.slug}`, {
        type: 'VIEW_PRODUCT',
        label: product.name,
        productSlug: product.slug,
        apiPath: `/products/${product.slug}`,
      });
    }

    if (e.tool === 'get_checkout') {
      const checkout = e.result.data as CheckoutResponseDto;
      for (const a of checkout.actions) {
        // Exposed only when the domain says it is usable, nothing blocks it, AND a real URL exists.
        const eligible = a.usable === true && a.blockingIssues.length === 0 && a.url !== null && isSafeHttpUrl(a.url);
        if (!eligible) {
          if (!actions.has(`CHECKOUT:${checkout.product.slug}`)) {
            actions.set(`CHECKOUT_UNAVAILABLE:${checkout.product.slug}`, {
              type: 'CHECKOUT_UNAVAILABLE',
              label: 'Online payment unavailable',
              productSlug: checkout.product.slug,
              reasons: a.blockingIssues.map(({ code, message }) => ({ code, message })),
            });
          }
          continue;
        }
        actions.delete(`CHECKOUT_UNAVAILABLE:${checkout.product.slug}`);
        actions.set(`CHECKOUT:${checkout.product.slug}`, {
          type: 'CHECKOUT',
          label: a.offer?.display ? `Enroll — ${a.offer.display}` : 'Enroll',
          url: a.url!,
          productSlug: checkout.product.slug,
          offer: a.offer,
          systemOfRecord: a.systemOfRecord,
        });
      }
    }
  }
  return [...actions.values()];
}
