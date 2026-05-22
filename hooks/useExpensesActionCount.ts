'use client';

import { useEffect, useRef, useState } from 'react';

export interface ExpensesActionCount {
  allCount: number;
  draftsCount: number;
  unpaidCount: number;
  partialCount: number;
  paidCount: number;
  archivedCount: number;
}

export function useExpensesActionCount(refreshKey = 0): ExpensesActionCount {
  const [counts, setCounts] = useState<ExpensesActionCount>({
    allCount: 0,
    draftsCount: 0,
    unpaidCount: 0,
    partialCount: 0,
    paidCount: 0,
    archivedCount: 0,
  });
  const requestIdRef = useRef(0);
  const activeRequestControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchCounts() {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;

      activeRequestControllerRef.current?.abort();
      const requestController = new AbortController();
      activeRequestControllerRef.current = requestController;

      try {
        const [allRes, draftsRes, unpaidRes, partialRes, paidRes, archivedRes] = await Promise.all([
          fetch('/api/expenses?limit=1', { cache: 'no-store', signal: requestController.signal }),
          fetch('/api/expenses?status=draft&limit=1', { cache: 'no-store', signal: requestController.signal }),
          fetch('/api/expenses?status=active&paymentStatus=unpaid&limit=1', { cache: 'no-store', signal: requestController.signal }),
          fetch('/api/expenses?status=active&paymentStatus=partial&limit=1', { cache: 'no-store', signal: requestController.signal }),
          fetch('/api/expenses?status=active&paymentStatus=paid&limit=1', { cache: 'no-store', signal: requestController.signal }),
          fetch('/api/expenses?status=archived&limit=1', { cache: 'no-store', signal: requestController.signal }),
        ]);

        if (cancelled || requestController.signal.aborted || requestId !== requestIdRef.current) return;

        const allPayload = allRes.ok ? ((await allRes.json()) as { pagination?: { total?: number } }) : null;
        const draftsPayload = draftsRes.ok ? ((await draftsRes.json()) as { pagination?: { total?: number } }) : null;
        const unpaidPayload = unpaidRes.ok ? ((await unpaidRes.json()) as { pagination?: { total?: number } }) : null;
        const partialPayload = partialRes.ok ? ((await partialRes.json()) as { pagination?: { total?: number } }) : null;
        const paidPayload = paidRes.ok ? ((await paidRes.json()) as { pagination?: { total?: number } }) : null;
        const archivedPayload = archivedRes.ok ? ((await archivedRes.json()) as { pagination?: { total?: number } }) : null;

        if (!cancelled && !requestController.signal.aborted && requestId === requestIdRef.current) {
          setCounts({
            allCount: allPayload?.pagination?.total ?? 0,
            draftsCount: draftsPayload?.pagination?.total ?? 0,
            unpaidCount: unpaidPayload?.pagination?.total ?? 0,
            partialCount: partialPayload?.pagination?.total ?? 0,
            paidCount: paidPayload?.pagination?.total ?? 0,
            archivedCount: archivedPayload?.pagination?.total ?? 0,
          });
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }

        // Keep previous values on transient network errors.
      }
    }

    void fetchCounts();
    const intervalId = window.setInterval(fetchCounts, 30_000);

    function handleRefresh() {
      void fetchCounts();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        void fetchCounts();
      }
    }

    window.addEventListener('focus', handleRefresh);
    window.addEventListener('expenses:refresh', handleRefresh as EventListener);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      activeRequestControllerRef.current?.abort();
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleRefresh);
      window.removeEventListener('expenses:refresh', handleRefresh as EventListener);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refreshKey]);

  return counts;
}