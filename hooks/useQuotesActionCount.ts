'use client';

import { useEffect, useState } from 'react';

export interface QuotesActionCount {
  allCount: number;
  draftCount: number;
  sentCount: number;
  rejectedCount: number;
  acceptedCount: number;
}

export function useQuotesActionCount(refreshKey = 0): QuotesActionCount {
  const [counts, setCounts] = useState<QuotesActionCount>({
    allCount: 0,
    draftCount: 0,
    sentCount: 0,
    rejectedCount: 0,
    acceptedCount: 0,
  });

  useEffect(() => {
    let cancelled = false;

    async function fetchCounts() {
      try {
        const [allRes, draftRes, sentRes, rejRes, accRes] = await Promise.all([
          fetch('/api/quotes?limit=1', { cache: 'no-store' }),
          fetch('/api/quotes?status=draft&limit=1', { cache: 'no-store' }),
          fetch('/api/quotes?status=sent&limit=1', { cache: 'no-store' }),
          fetch('/api/quotes?status=rejected&limit=1', { cache: 'no-store' }),
          fetch('/api/quotes?status=accepted&limit=1', { cache: 'no-store' }),
        ]);

        if (cancelled) return;

        const allPayload = allRes.ok
          ? ((await allRes.json()) as { pagination?: { total?: number } })
          : null;
        const draftPayload = draftRes.ok
          ? ((await draftRes.json()) as { pagination?: { total?: number } })
          : null;
        const sentPayload = sentRes.ok
          ? ((await sentRes.json()) as { pagination?: { total?: number } })
          : null;
        const rejPayload = rejRes.ok
          ? ((await rejRes.json()) as { pagination?: { total?: number } })
          : null;
        const accPayload = accRes.ok
          ? ((await accRes.json()) as { pagination?: { total?: number } })
          : null;

        if (!cancelled) {
          setCounts({
            allCount: allPayload?.pagination?.total ?? 0,
            draftCount: draftPayload?.pagination?.total ?? 0,
            sentCount: sentPayload?.pagination?.total ?? 0,
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
