'use client';

import { useEffect, useState } from 'react';

export interface QuotesActionCount {
  /** Total count for the "All" tab */
  allCount: number;
  /** Total count for the "Draft" tab */
  draftCount: number;
  /** Total count for the "Sent" tab */
  sentCount: number;
  /** Total count for the "Rejected" tab (all rejected, for tab label only) */
  rejectedCount: number;
  /** Total count for the "Accepted" tab (all accepted, for tab label only) */
  acceptedCount: number;

  // ── Actionable counts ─────────────────────────────────────────────────────
  // These drive sidebar badges and page banners. They disappear when the user
  // completes the specific action described below.

  /** Accepted quotes not yet converted to an invoice. Disappears on "Convert to invoice". */
  pendingInvoiceCount: number;
  /** Rejected quotes the user hasn't reviewed yet. Disappears on "Mark as reviewed". */
  unacknowledgedRejectedCount: number;
}

export function useQuotesActionCount(refreshKey = 0): QuotesActionCount {
  const [counts, setCounts] = useState<QuotesActionCount>({
    allCount: 0,
    draftCount: 0,
    sentCount: 0,
    rejectedCount: 0,
    acceptedCount: 0,
    pendingInvoiceCount: 0,
    unacknowledgedRejectedCount: 0,
  });

  useEffect(() => {
    let cancelled = false;

    async function fetchCounts() {
      try {
        const [allRes, draftRes, sentRes, rejRes, accRes, actionRes] = await Promise.all([
          fetch('/api/quotes?limit=1', { cache: 'no-store' }),
          fetch('/api/quotes?status=draft&limit=1', { cache: 'no-store' }),
          fetch('/api/quotes?status=sent&limit=1', { cache: 'no-store' }),
          fetch('/api/quotes?status=rejected&limit=1', { cache: 'no-store' }),
          fetch('/api/quotes?status=accepted&limit=1', { cache: 'no-store' }),
          fetch('/api/quotes/action-counts', { cache: 'no-store' }),
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
        const actionPayload = actionRes.ok
          ? ((await actionRes.json()) as { data?: { pendingInvoice?: number; unacknowledgedRejected?: number } })
          : null;

        if (!cancelled) {
          setCounts({
            allCount: allPayload?.pagination?.total ?? 0,
            draftCount: draftPayload?.pagination?.total ?? 0,
            sentCount: sentPayload?.pagination?.total ?? 0,
            rejectedCount: rejPayload?.pagination?.total ?? 0,
            acceptedCount: accPayload?.pagination?.total ?? 0,
            pendingInvoiceCount: actionPayload?.data?.pendingInvoice ?? 0,
            unacknowledgedRejectedCount: actionPayload?.data?.unacknowledgedRejected ?? 0,
          });
        }
      } catch {
        // Keep previous counts on transient errors.
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
