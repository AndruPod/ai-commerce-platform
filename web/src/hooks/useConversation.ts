'use client';

import { useCallback, useRef, useState } from 'react';
import { ApiError, type CommerceApi } from '@/lib/api/client';
import type { ChatHistoryMessage, ChatResponse } from '@/lib/api/types';

export interface UserTurn {
  id: string;
  role: 'user';
  content: string;
}
export interface AssistantTurn {
  id: string;
  role: 'assistant';
  content: string;
  response: ChatResponse;
}
export interface ErrorTurn {
  id: string;
  role: 'error';
  error: ApiError;
}
export type Turn = UserTurn | AssistantTurn | ErrorTurn;

const MAX_HISTORY = 20;

/**
 * History sent to /ai/chat: completed user/assistant exchanges only (a user
 * message whose request failed is dropped). Assistant entries carry the
 * `context.productSlugs` the API returned, so follow-ups stay grounded.
 */
export function buildHistory(turns: Turn[]): ChatHistoryMessage[] {
  const history: ChatHistoryMessage[] = [];
  for (let i = 0; i < turns.length; i++) {
    const t = turns[i];
    const next = turns[i + 1];
    if (t.role === 'user' && next?.role === 'assistant') {
      history.push({ role: 'user', content: t.content });
    } else if (t.role === 'assistant') {
      history.push({ role: 'assistant', content: t.content.slice(0, 4000), productSlugs: t.response.context.productSlugs });
    }
  }
  return history.slice(-MAX_HISTORY);
}

export function browserTimezone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

export function useConversation(api: CommerceApi, timezone: string | undefined) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [pending, setPending] = useState(false);
  const seq = useRef(0);
  const turnsRef = useRef<Turn[]>([]);

  const update = (next: Turn[]) => {
    turnsRef.current = next;
    setTurns(next);
  };

  const send = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (!message || pending) return;
      const history = buildHistory(turnsRef.current);
      const userTurn: UserTurn = { id: `t${++seq.current}`, role: 'user', content: message };
      update([...turnsRef.current, userTurn]);
      setPending(true);
      try {
        const response = await api.chat({ message, timezone, history });
        update([...turnsRef.current, { id: `t${++seq.current}`, role: 'assistant', content: response.message, response }]);
      } catch (err) {
        const error = err instanceof ApiError ? err : new ApiError('UNEXPECTED', 'Something went wrong.');
        update([...turnsRef.current, { id: `t${++seq.current}`, role: 'error', error }]);
      } finally {
        setPending(false);
      }
    },
    [api, pending, timezone],
  );

  const reset = useCallback(() => update([]), []);

  return { turns, pending, send, reset };
}

/** Product the UI should show: latest VIEW_PRODUCT/checkout action, else latest API context. */
export function activeProductSlug(turns: Turn[]): string | null {
  for (let i = turns.length - 1; i >= 0; i--) {
    const t = turns[i];
    if (t.role !== 'assistant') continue;
    const action = [...t.response.actions].reverse().find((a) => 'productSlug' in a);
    if (action) return action.productSlug;
    const ctx = t.response.context.productSlugs;
    if (ctx.length > 0) return ctx[ctx.length - 1];
  }
  return null;
}
