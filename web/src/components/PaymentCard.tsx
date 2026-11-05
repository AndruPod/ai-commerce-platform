'use client';

import { useId, useState } from 'react';
import type { ChatAction, CheckoutAction, ProductDetail } from '@/lib/api/types';
import { billingSuffix, checkoutBlockCopy, formatMoney, pricingBasisLabel } from '@/lib/labels';
import { Badge, Card, Note, Row } from './ui';

interface Props {
  checkout: CheckoutAction | null;
  offer: ProductDetail['offers'][number] | null;
  /** Latest backend-built checkout action for this product from /ai/chat, if any. */
  chatAction: Extract<ChatAction, { type: 'CHECKOUT' | 'CHECKOUT_UNAVAILABLE' }> | null;
}

/**
 * Payment is shown separately from enrollment. A payment link is rendered only
 * when the domain says the checkout is usable AND no backend action says it is
 * unavailable. Blocked checkouts never render a URL, only the reason.
 */
export function PaymentCard({ checkout, offer, chatAction }: Props) {
  const [open, setOpen] = useState(false);
  const detailsId = useId();

  const blockedByChat = chatAction?.type === 'CHECKOUT_UNAVAILABLE';
  const link = !blockedByChat && checkout?.usable && checkout.url ? checkout.url : null;

  if (!checkout) {
    return (
      <Card title="Payment">
        <p className="text-sm text-slate-600">No checkout is configured for this product.</p>
      </Card>
    );
  }

  if (link) {
    const price = checkout.offer?.amountMinor != null && checkout.offer.currency ? formatMoney(checkout.offer.amountMinor, checkout.offer.currency) : null;
    return (
      <Card title="Payment" aside={<Badge tone="ok">Available</Badge>}>
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-full items-center justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
        >
          {price ? `Enroll — ${price}` : 'Enroll'}
        </a>
        <Note>Payment is handled by the external checkout ({checkout.systemOfRecord}).</Note>
      </Card>
    );
  }

  const reasons = blockedByChat && chatAction.reasons.length > 0 ? chatAction.reasons : checkout.blockingIssues;
  const primary = checkoutBlockCopy(reasons[0]?.code ?? 'UNKNOWN');
  const conflict = checkout.verification.verificationStatus === 'CONFLICTING';
  const observed = checkout.observedTerms;
  const authoritative = offer?.price ?? null;

  return (
    <Card title="Payment" aside={<Badge tone="warn">{primary.headline}</Badge>}>
      <button
        type="button"
        disabled
        className="inline-flex w-full cursor-not-allowed items-center justify-center rounded-lg border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-500"
      >
        Payment unavailable
      </button>
      <div className="mt-3 flex gap-2.5 rounded-lg bg-amber-50 px-3 py-2.5 text-amber-900 ring-1 ring-inset ring-amber-200">
        <span aria-hidden="true" className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-200 text-xs font-bold">
          !
        </span>
        <p className="text-sm leading-snug">{primary.explanation}</p>
      </div>

      {(observed || conflict) && (
        <div className="mt-3">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={detailsId}
            onClick={() => setOpen((o) => !o)}
            className="text-sm font-medium text-slate-900 underline decoration-slate-300 underline-offset-4 hover:decoration-slate-900"
          >
            {open ? 'Hide details' : 'View details'}
          </button>
          {open && (
            <div id={detailsId} className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <dl>
                {authoritative && (
                  <Row label="Published program offer">
                    {formatMoney(authoritative.amountMinor, authoritative.currency)}
                    {offer && <span className="text-slate-500"> · {pricingBasisLabel(offer.pricingBasis).toLowerCase()}</span>}
                  </Row>
                )}
                {observed?.amountMinor != null && observed.currency && (
                  <Row label="Captured checkout">
                    {formatMoney(observed.amountMinor, observed.currency)}
                    {billingSuffix(observed.billing)}
                    {observed.observedAt && <span className="block text-xs text-slate-500">Observed on the checkout page, {observed.observedAt}</span>}
                  </Row>
                )}
                <Row label="Status">{conflict ? 'Needs business confirmation' : 'Not available'}</Row>
              </dl>
              {conflict && (
                <p className="mt-3 text-sm text-slate-700">
                  These commercial terms conflict, so this prototype does not expose the payment link until the discrepancy is resolved.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
