import type { Ref } from 'react';
import type { AssistantTurn } from '@/hooks/useConversation';
import type { CheckoutAction } from '@/lib/api/types';
import { TOOL_LABELS } from '@/lib/labels';

const reasonLabel = (code: string) => code.toLowerCase().replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

/**
 * Demo/debug view. Shows normalised codes on purpose, but only safe fields:
 * tool names, validated arguments, timings, action types and reasons. No raw
 * tool payloads, prompts, secrets or blocked checkout URLs.
 */
interface Props {
  turn: AssistantTurn | null;
  turnIndex: number | null;
  checkout: CheckoutAction | null;
  /** Collapsed by default; "Show trace" in the chat opens it. */
  open: boolean;
  onToggle: (open: boolean) => void;
  ref?: Ref<HTMLDetailsElement>;
}

export function TechnicalDetails({ turn, turnIndex, checkout, open, onToggle, ref }: Props) {
  const response = turn?.response;
  const blocked = response?.actions.find((a) => a.type === 'CHECKOUT_UNAVAILABLE');
  const allowed = response?.actions.find((a) => a.type === 'CHECKOUT');

  return (
    <details
      ref={ref}
      open={open}
      onToggle={(e) => onToggle(e.currentTarget.open)}
      className="group scroll-mt-4 rounded-xl border border-slate-200 bg-slate-50/60"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between rounded-xl px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900">
        <span>
          Technical details
          <span className="ml-2 font-normal text-slate-400">{turnIndex ? `AI action trace · answer ${turnIndex}` : 'AI action trace'}</span>
        </span>
        <span aria-hidden="true" className="text-slate-400 transition group-open:rotate-180">
          ▾
        </span>
      </summary>
      <div className="grid gap-6 border-t border-slate-200 bg-white px-5 py-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Tool calls</h3>
          {!response || response.toolTrace.length === 0 ? (
            <p className="text-sm text-slate-500">{response ? 'No tools were called for this answer.' : 'Send a message to see the tool trace.'}</p>
          ) : (
            <table className="w-full text-left font-mono text-xs">
              <thead className="text-slate-400">
                <tr>
                  <th className="py-1 pr-3 font-normal">#</th>
                  <th className="py-1 pr-3 font-normal">tool</th>
                  <th className="py-1 pr-3 font-normal">result</th>
                  <th className="py-1 pr-3 text-right font-normal">ms</th>
                  <th className="py-1 font-normal">validated arguments</th>
                </tr>
              </thead>
              <tbody className="text-slate-700">
                {response.toolTrace.map((t, i) => (
                  <tr key={i} className="border-t border-slate-100 align-top">
                    <td className="py-1.5 pr-3 text-slate-400">{i + 1}</td>
                    <td className="py-1.5 pr-3">
                      {t.tool}
                      <span className="block font-sans text-[11px] text-slate-400">{TOOL_LABELS[t.tool] ?? ''}</span>
                    </td>
                    <td className="py-1.5 pr-3">{t.success ? '✓ ok' : `✗ ${t.errorCode ?? 'failed'}`}</td>
                    <td className="py-1.5 pr-3 text-right">{t.durationMs}</td>
                    <td className="break-all py-1.5 text-slate-500">{t.arguments ? JSON.stringify(t.arguments) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {response && (
            <p className="mt-3 font-mono text-[11px] text-slate-500">
              Model {response.meta.model} · {response.meta.iterations} model round trip{response.meta.iterations === 1 ? '' : 's'} · stop:{' '}
              {response.meta.stoppedReason}
            </p>
          )}
        </div>

        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Transaction safety</h3>
          <dl className="grid grid-cols-[7rem_minmax(0,1fr)] gap-y-1.5 font-mono text-xs">
            <dt className="font-sans text-slate-500">Transaction</dt>
            <dd className="font-medium text-slate-900">{blocked ? 'Blocked' : allowed ? 'Allowed (backend-built action)' : 'Not evaluated in this answer'}</dd>
            {blocked && (
              <>
                <dt className="font-sans text-slate-500">Reason</dt>
                <dd className="text-slate-900">
                  {blocked.reasons.map((r) => (
                    <span key={r.code} className="block">
                      {reasonLabel(r.code)} <code className="text-slate-500">{r.code}</code>
                    </span>
                  ))}
                </dd>
              </>
            )}
            {checkout && (
              <>
                <dt className="font-sans text-slate-500">Checkout</dt>
                <dd className="text-slate-900">
                  URL captured: {checkout.urlCaptured ? 'yes' : 'no'} · withheld: {checkout.urlWithheld ? 'yes' : 'no'} · usable: {checkout.usable ? 'yes' : 'no'}
                  <code className="block text-slate-500">verification {checkout.verification.verificationStatus}</code>
                </dd>
              </>
            )}
            {response && (
              <>
                <dt className="font-sans text-slate-500">Actions</dt>
                <dd className="font-mono text-xs text-slate-700">{response.actions.map((a) => a.type).join(', ') || '—'}</dd>
                <dt className="font-sans text-slate-500">Context</dt>
                <dd className="font-mono text-xs text-slate-700">{response.context.productSlugs.join(', ') || '—'}</dd>
              </>
            )}
          </dl>
        </div>
      </div>
    </details>
  );
}
