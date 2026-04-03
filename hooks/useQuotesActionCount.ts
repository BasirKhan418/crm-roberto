'use client';

import { useEffect, useState } from 'react';

export interface QuotesActionCount {
  rejectedCount: number;
  acceptedCount: number;
}

export function useQuotesActionCount(refreshKey = 0): QuotesActionCount {
  const [counts, setCounts] = useState<QuotesActionCount>({ rejectedCount: 0, acceptedCount: 0 });

  useEffect(() => {
    let cancelled = false;

    async function fetchCounts() {
      try {
        const [rejRes, accRes] = await Promise.all([
          fetch('/api/quotes?status=rejected&limit=1', { cache: 'no-store' }),
          fetch('/api/quotes?status=accepted&limit=1', { cache: 'no-store' }),
        ]);

        if (cancelled) return;

        const rejPayload = rejRes.ok
          ? ((await rejRes.json()) as { pagination?: { total?: number } })
          : null;
        const accPayload = accRes.ok
          ? ((await accRes.json()) as { pagination?: { total?: number } })
          : null;

        if (!cancelled) {
          setCounts({
            rejectedCount: rejPayload?.pagination?.total ?? 0,
            acceptedCount: accPayload?.pagination?.total ?? 0,
          });
        }
      } catch {
  
      }
    }

    void fetchCounts();
    const intervalId = window.setInterval(fetchCounts, 30_000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [refreshKey]);

  return counts;
}
