'use client';

import { useEffect, useState } from 'react';

export function useSignedQuotesCount() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function fetchCount() {
      try {
        const response = await fetch('/api/quotes?status=accepted&limit=1', { cache: 'no-store' });
        if (!response.ok) return;
        const payload = (await response.json()) as { pagination?: { total?: number } };
        if (!cancelled) {
          setCount(payload.pagination?.total ?? 0);
        }
      } catch {
        // silently ignore — sidebar badge is non-critical
      }
    }

    fetchCount();

    return () => {
      cancelled = true;
    };
  }, []);

  return count;
}
