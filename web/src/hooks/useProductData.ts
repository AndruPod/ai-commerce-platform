'use client';

import { useCallback } from 'react';
import type { CommerceApi } from '@/lib/api/client';
import { useAsyncData } from './useAsyncData';

/** Authoritative product, schedule, enrollment and checkout data for the panel. */
export function useProductData(api: CommerceApi, slug: string | null, timezone: string | undefined, refreshToken: number) {
  const loader = useCallback(async () => {
    const s = slug!;
    const [product, schedule, enrollment, checkout] = await Promise.all([
      api.getProduct(s),
      api.getSchedule(s, timezone).catch(() => null), // a product may have no schedule
      api.getEnrollment(s),
      api.getCheckout(s),
    ]);
    return { product, schedule, enrollment, checkout };
    // refreshToken re-runs the load after each assistant turn
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, slug, timezone, refreshToken]);
  return useAsyncData(slug ? `${slug}|${timezone ?? ''}|${refreshToken}` : null, loader);
}
