'use client';

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import type { AssistantTurn, Turn } from '@/hooks/useConversation';
import { DateCheckCard } from './DateCheckCard';
import { RichText } from './RichText';

export const STARTER_QUERIES = [
  "I'm a beginner looking for online ballet classes for a year.",
  'How much is the VSA annual ballet program?',
  'Can I join around November 6, 2026?',
  'How do I enroll and pay?',
];

interface Props {
  turns: Turn[];
  pending: boolean;
  onSend: (text: string) => void;
  onReset: () => void;
  selectedTurnId: string | null;
  onSelectTurn: (id: string) => void;
}

export function ChatPanel({ turns, pending, onSend, onReset, selectedTurnId, onSelectTurn }: Props) {
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Keep the newest content in view: the start of the latest answer (long answers
  // read from the top), or the bottom while a request is pending.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const last = el.querySelector<HTMLElement>('[data-turn]:last-of-type');
    // offsetTop is relative to this (position: relative) container.
    el.scrollTop = !pending && last && last.dataset.turn !== 'user' ? last.offsetTop - 16 : el.scrollHeight;
  }, [turns.length, pending]);

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!draft.trim() || pending) return;
    onSend(draft);
    setDraft('');
  };
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <section
      className={`flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm ${turns.length > 0 || pending ? 'min-h-[28rem] lg:h-[calc(100vh-8.5rem)]' : ''}`}
      aria-label="AI assistant"
    >
      <header className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight text-slate-900">AI assistant</h2>
          <p className="text-xs text-slate-500">Answers come from live product, schedule and checkout data.</p>
        </div>
        {turns.length > 0 && (
          <button type="button" onClick={onReset} disabled={pending} className="shrink-0 whitespace-nowrap text-xs font-medium text-slate-500 hover:text-slate-900 disabled:opacity-50">
            New conversation
          </button>
        )}
      </header>

      <div ref={scrollRef} className="relative min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5" aria-live="polite">
        {turns.length === 0 && <StarterQueries onPick={onSend} disabled={pending} />}
        {turns.map((t) =>
          t.role === 'user' ? (
            <div key={t.id} data-turn="user" className="flex justify-end">
              <p className="max-w-[80%] whitespace-pre-wrap rounded-xl bg-slate-100 px-4 py-2.5 text-[15px] leading-relaxed text-slate-900">{t.content}</p>
            </div>
          ) : t.role === 'assistant' ? (
            <div key={t.id} data-turn="assistant">
              <AssistantMessage turn={t} selected={t.id === selectedTurnId} onSelect={() => onSelectTurn(t.id)} />
            </div>
          ) : (
            <div key={t.id} data-turn="error" role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              <span className="font-semibold">Couldn&apos;t get an answer.</span> {t.error.message}
            </div>
          ),
        )}
        {pending && (
          <div className="flex items-center gap-2 pl-4 text-sm text-slate-500" role="status">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-slate-400" aria-hidden="true" />
            Checking the commerce data…
          </div>
        )}
      </div>

      <form onSubmit={submit} className="border-t border-slate-100 p-3">
        <label htmlFor="chat-input" className="sr-only">
          Message
        </label>
        <div className="flex items-end gap-2">
          <textarea
            id="chat-input"
            rows={1}
            value={draft}
            maxLength={2000}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask about programs, prices, dates or enrollment…"
            className="min-h-[2.75rem] flex-1 resize-none rounded-lg border border-slate-300 px-3 py-2.5 text-[15px] text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
          />
          <button
            type="submit"
            disabled={pending || !draft.trim()}
            className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {pending ? 'Sending…' : 'Send'}
          </button>
        </div>
        <p className="mt-1.5 text-[11px] text-slate-400">Enter to send · Shift+Enter for a new line</p>
      </form>
    </section>
  );
}

function StarterQueries({ onPick, disabled }: { onPick: (q: string) => void; disabled: boolean }) {
  return (
    <div>
      <p className="text-sm font-medium text-slate-900">Try a question</p>
      <p className="mb-3 text-xs text-slate-500">These send real messages to the assistant.</p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {STARTER_QUERIES.map((q) => (
          <li key={q}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onPick(q)}
              className="h-full w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-left text-sm text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 disabled:opacity-50"
            >
              {q}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AssistantMessage({ turn, selected, onSelect }: { turn: AssistantTurn; selected: boolean; onSelect: () => void }) {
  const { response } = turn;
  const dateCall = [...response.toolTrace].reverse().find((t) => t.tool === 'check_date' && t.success && t.arguments);
  const unavailable = response.actions.find((a) => a.type === 'CHECKOUT_UNAVAILABLE');
  const ms = response.toolTrace.reduce((sum, t) => sum + t.durationMs, 0);

  return (
    <article
      className={`max-w-[68ch] border-l-2 pl-4 text-[15px] leading-7 text-slate-800 ${selected ? 'border-slate-300' : 'border-transparent'}`}
      aria-label="Assistant answer"
    >
      <RichText text={turn.content} />
      {dateCall && (
        <DateCheckCard
          productSlug={String(dateCall.arguments!.productSlug)}
          date={String(dateCall.arguments!.date)}
          timezone={dateCall.arguments!.timezone ? String(dateCall.arguments!.timezone) : undefined}
        />
      )}
      {unavailable && (
        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm leading-snug text-amber-900 ring-1 ring-inset ring-amber-200">
          <span aria-hidden="true" className="font-bold">! </span>Online payment is unavailable for this product. See the Payment panel for details.
        </p>
      )}
      <footer className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
        <span>
          {response.toolTrace.length} tool call{response.toolTrace.length === 1 ? '' : 's'} · {ms} ms
        </span>
        <span aria-hidden="true">·</span>
        <button type="button" onClick={onSelect} className="text-slate-500 underline-offset-2 hover:text-slate-900 hover:underline">
          Show trace
        </button>
      </footer>
    </article>
  );
}
