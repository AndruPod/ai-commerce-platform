'use client';

import { useEffect, useState } from 'react';
import { ApiError } from '@/lib/api/client';

interface Settled<T> {
  key: string;
  data?: T;
  error?: ApiError;
}

/**
 * Loads data for a request key. Results are stored with the key they belong to,
 * so stale responses never overwrite newer ones and `loading` is derived.
 * `loader` must be stable for a given key (wrap it in useCallback).
 */
export function useAsyncData<T>(key: string | null, loader: () => Promise<T>) {
  const [settled, setSettled] = useState<Settled<T> | null>(null);

  useEffect(() => {
    if (key === null) return;
    let cancelled = false;
    loader().then(
      (data) => !cancelled && setSettled({ key, data }),
      (err: unknown) =>
        !cancelled && setSettled({ key, error: err instanceof ApiError ? err : new ApiError('UNEXPECTED', 'Something went wrong while loading data.') }),
    );
    return () => {
      cancelled = true;
    };
  }, [key, loader]);

  const current = settled && settled.key === key ? settled : null;
  return { data: current?.data, error: current?.error, loading: key !== null && current === null };
}
