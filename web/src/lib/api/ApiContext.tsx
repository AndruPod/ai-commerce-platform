'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { createApiClient, type CommerceApi } from './client';

const ApiContext = createContext<CommerceApi | null>(null);

/** Provides the API client; tests inject a stub instead of the real fetch client. */
export function ApiProvider({ client, children }: { client?: CommerceApi; children: ReactNode }) {
  const value = useMemo(() => client ?? createApiClient(), [client]);
  return <ApiContext.Provider value={value}>{children}</ApiContext.Provider>;
}

export function useApi(): CommerceApi {
  const api = useContext(ApiContext);
  if (!api) throw new Error('useApi must be used inside <ApiProvider>');
  return api;
}
