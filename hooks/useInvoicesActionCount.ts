'use client';

import { useEffect, useState } from 'react';

export interface InvoicesActionCount {
  allCount: number;
  unpaidCount: number;
  partialPaidCount: number;
  paidCount: number;
  overdueCount: number;
}

export function useInvoicesActionCount(refreshKey = 0): InvoicesActionCount {
  const [counts, setCounts] = useState<InvoicesActionCount>({
    allCount: 0,
    unpaidCount: 0,
    partialPaidCount: 0,
    paidCount: 0,
    overdueCount: 0,
  });

  useEffect(() => {
    let cancelled = false;

    async function fetchCounts() {
      try {
        const [allRes, unpaidRes, partialRes, paidRes, overdueRes] = await Promise.all([
          fetch('/api/invoices?limit=1', { cache: 'no-store' }),
          fetch('/api/invoices?status=unpaid&limit=1', { cache: 'no-store' }),
          fetch('/api/invoices?status=partial_paid&limit=1', { cache: 'no-store' }),
          fetch('/api/invoices?status=paid&limit=1', { cache: 'no-store' }),
          fetch('/api/invoices?status=overdue&limit=1', { cache: 'no-store' }),
        ]);

        if (cancelled) return;

        const allPayload = allRes.ok ? ((await allRes.json()) as { pagination?: { total?: number } }) : null;
        const unpaidPayload = unpaidRes.ok ? ((await unpaidRes.json()) as { pagination?: { total?: number } }) : null;
        const partialPayload = partialRes.ok ? ((await partialRes.json()) as { pagination?: { total?: number } }) : null;
        const paidPayload = paidRes.ok ? ((await paidRes.json()) as { pagination?: { total?: number } }) : null;
        const overduePayload = overdueRes.ok ? ((await overdueRes.json()) as { pagination?: { total?: number } }) : null;

        if (!cancelled) {
          setCounts({
            allCount: allPayload?.pagination?.total ?? 0,
            unpaidCount: unpaidPayload?.pagination?.total ?? 0,
            partialPaidCount: partialPayload?.pagination?.total ?? 0,
            paidCount: paidPayload?.pagination?.total ?? 0,
            overdueCount: overduePayload?.pagination?.total ?? 0,
          });
        }
      } catch {
        // Keep previous counts on transient network errors.
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
