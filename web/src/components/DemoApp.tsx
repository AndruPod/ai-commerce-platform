'use client';

import { useEffect, useRef, useState } from 'react';
import { useApi } from '@/lib/api/ApiContext';
import type { ChatAction } from '@/lib/api/types';
import { activeProductSlug, browserTimezone, useConversation, type AssistantTurn } from '@/hooks/useConversation';
import { useProductData } from '@/hooks/useProductData';
import { ChatPanel } from './ChatPanel';
import { ProductPanel } from './ProductPanel';
import { TechnicalDetails } from './TechnicalDetails';

type Connection = 'checking' | 'connected' | 'unreachable';

export function DemoApp({ timezone: tzOverride }: { timezone?: string } = {}) {
  const api = useApi();
  const [timezone] = useState(() => tzOverride ?? browserTimezone());
  const { turns, pending, send, reset } = useConversation(api, timezone);
  const [connection, setConnection] = useState<Connection>('checking');
  const [selectedTurnId, setSelectedTurnId] = useState<string | null>(null);
  const [traceOpen, setTraceOpen] = useState(false);
  const traceRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    let cancelled = false;
    api.ping().then((ok) => !cancelled && setConnection(ok ? 'connected' : 'unreachable'));
    return () => {
      cancelled = true;
    };
  }, [api]);

  const assistantTurns = turns.filter((t): t is AssistantTurn => t.role === 'assistant');
  const latest = assistantTurns[assistantTurns.length - 1] ?? null;
  const selected = assistantTurns.find((t) => t.id === selectedTurnId) ?? latest;
  const slug = activeProductSlug(turns);

  // Reload authoritative panel data after every assistant answer.
  const product = useProductData(api, slug, timezone, assistantTurns.length);

  const chatCheckoutAction = latestCheckoutAction(assistantTurns, slug);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <h1 className="text-base font-semibold tracking-tight text-slate-900">AI Commerce Prototype</h1>
            <p className="text-sm text-slate-500">Victory Skating / VSA</p>
          </div>
          <ConnectionStatus state={connection} baseUrl={api.baseUrl} />
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-4 px-4 py-4 sm:px-6">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_25rem]">
          <ChatPanel
            turns={turns}
            pending={pending}
            onSend={send}
            onReset={() => {
              reset();
              setSelectedTurnId(null);
            }}
            selectedTurnId={selected?.id ?? null}
            onSelectTurn={(id) => {
              setSelectedTurnId(id);
              setTraceOpen(true);
              requestAnimationFrame(() => traceRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }));
            }}
          />
          <aside className="space-y-3 lg:max-h-[calc(100vh-8.5rem)] lg:overflow-y-auto" aria-label="Structured product data">
            <ProductPanel
              data={product.data ?? undefined}
              loading={product.loading}
              error={product.error?.message ?? null}
              chatCheckoutAction={chatCheckoutAction}
              timezone={timezone}
            />
          </aside>
        </div>
        <TechnicalDetails
          ref={traceRef}
          open={traceOpen}
          onToggle={setTraceOpen}
          turn={selected}
          turnIndex={selected ? assistantTurns.indexOf(selected) + 1 : null}
          checkout={product.data?.checkout.actions[0] ?? null}
        />
      </main>
    </div>
  );
}

/** Latest backend-built CHECKOUT / CHECKOUT_UNAVAILABLE action for the shown product. */
function latestCheckoutAction(turns: AssistantTurn[], slug: string | null) {
  for (let i = turns.length - 1; i >= 0; i--) {
    const a = turns[i].response.actions.find(
      (x): x is Extract<ChatAction, { type: 'CHECKOUT' | 'CHECKOUT_UNAVAILABLE' }> =>
        (x.type === 'CHECKOUT' || x.type === 'CHECKOUT_UNAVAILABLE') && x.productSlug === slug,
    );
    if (a) return a;
  }
  return null;
}

function ConnectionStatus({ state, baseUrl }: { state: Connection; baseUrl: string }) {
  const label = state === 'connected' ? 'Connected' : state === 'checking' ? 'Connecting…' : 'API unreachable';
  const dot = state === 'connected' ? 'bg-emerald-500' : state === 'checking' ? 'bg-slate-300' : 'bg-red-500';
  return (
    <p className="flex items-center gap-2 text-xs text-slate-600" role="status" title={baseUrl}>
      <span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden="true" />
      {label}
    </p>
  );
}
