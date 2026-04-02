'use client';

import { useEffect, useState } from 'react';

export function useRejectedQuotesCount(refreshKey = 0) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function fetchCount() {
      try {
        const response = await fetch('/api/quotes?status=rejected&limit=1', { cache: 'no-store' });
        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as { pagination?: { total?: number } };
        if (!cancelled) {
          setCount(payload.pagination?.total ?? 0);
        }
      } catch {
        // Non-blocking UI hint only.
      }
    }

    void fetchCount();
    const intervalId = window.setInterval(fetchCount, 30000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [refreshKey]);

  return count;
}
