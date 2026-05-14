'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

export interface SidebarBadges {
  quotes: {
    accepted: number;
    pending: number;
    rejected: number;
  };
  invoices: {
    paid: number;
    pending: number;
    overdue: number;
  };
  tickets: {
    unread: number;
  };
}

const EMPTY_BADGES: SidebarBadges = {
  quotes: { accepted: 0, pending: 0, rejected: 0 },
  invoices: { paid: 0, pending: 0, overdue: 0 },
  tickets: { unread: 0 },
};

interface SidebarQuoteItem {
  id: string;
  bucket: 'accepted' | 'pending' | 'rejected';
  updatedAt: string;
}

interface SidebarInvoiceItem {
  id: string;
  bucket: 'paid' | 'pending' | 'overdue';
  updatedAt: string;
}

interface SidebarBadgeItemsPayload {
  quotes: SidebarQuoteItem[];
  invoices: SidebarInvoiceItem[];
  tickets?: {
    unreadCount?: number;
  };
}

interface SidebarSeenState {
  quotes: Record<string, string>;
  invoices: Record<string, string>;
}

interface SidebarMarkReadDetail {
  entityType: 'quote' | 'invoice';
  id: string;
  seenAt?: string;
}

const SIDEBAR_SEEN_STORAGE_KEY = 'crm.sidebar.seen.v1';

function readSeenState(): SidebarSeenState {
  if (typeof window === 'undefined') {
    return { quotes: {}, invoices: {} };
  }

  try {
    const raw = window.localStorage.getItem(SIDEBAR_SEEN_STORAGE_KEY);
    if (!raw) return { quotes: {}, invoices: {} };

    const parsed = JSON.parse(raw) as Partial<SidebarSeenState>;
    return {
      quotes: parsed.quotes ?? {},
      invoices: parsed.invoices ?? {},
    };
  } catch {
    return { quotes: {}, invoices: {} };
  }
}

function writeSeenState(next: SidebarSeenState) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SIDEBAR_SEEN_STORAGE_KEY, JSON.stringify(next));
}

function computeCounts(items: SidebarBadgeItemsPayload, seen: SidebarSeenState): SidebarBadges {
  const next: SidebarBadges = {
    quotes: { accepted: 0, pending: 0, rejected: 0 },
    invoices: { paid: 0, pending: 0, overdue: 0 },
    tickets: { unread: 0 },
  };

  for (const item of items.quotes) {
    const seenAt = seen.quotes[item.id];
    if (!seenAt || new Date(seenAt).getTime() < new Date(item.updatedAt).getTime()) {
      next.quotes[item.bucket] += 1;
    }
  }

  for (const item of items.invoices) {
    const seenAt = seen.invoices[item.id];
    if (!seenAt || new Date(seenAt).getTime() < new Date(item.updatedAt).getTime()) {
      next.invoices[item.bucket] += 1;
    }
  }

  next.tickets.unread = Math.max(0, Number(items.tickets?.unreadCount || 0));

  return next;
}

export function useSidebarBadges() {
  const [badges, setBadges] = useState<SidebarBadges>(EMPTY_BADGES);
  const fetchRef = useRef<() => Promise<void>>(async () => {});
  const itemsRef = useRef<SidebarBadgeItemsPayload>({ quotes: [], invoices: [], tickets: { unreadCount: 0 } });
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;

    async function fetchBadges() {
      try {
        const response = await fetch('/api/sidebar/badges', { cache: 'no-store' });
        if (!response.ok || cancelled) return;
        const payload = (await response.json()) as { success?: boolean; data?: SidebarBadgeItemsPayload };
        if (cancelled || !payload.success || !payload.data) return;
        itemsRef.current = {
          quotes: payload.data.quotes ?? [],
          invoices: payload.data.invoices ?? [],
          tickets: {
            unreadCount: payload.data.tickets?.unreadCount ?? 0,
          },
        };
        setBadges(computeCounts(itemsRef.current, readSeenState()));
      } catch {
        // Keep previous counts on transient errors.
      }
    }

    fetchRef.current = fetchBadges;
    void fetchBadges();

    // Refresh on activity changes (e.g., when a new quote is sent,
    // a payment is received, etc.) using the existing SSE channel.
    let source: EventSource | null = null;
    let closedByUnmount = false;

    const connect = () => {
      source = new EventSource('/api/activity/events');
      source.addEventListener('activity_changed', () => {
        void fetchBadges();
      });
      source.onerror = () => {
        if (closedByUnmount) {
          source?.close();
          return;
        }
        void fetchBadges();
      };
    };

    connect();

    // Polling safety net (1 min) in case SSE drops.
    const intervalId = window.setInterval(() => {
      void fetchBadges();
    }, 60_000);

    return () => {
      cancelled = true;
      closedByUnmount = true;
      source?.close();
      window.clearInterval(intervalId);
    };
  }, []);

  const refresh = useCallback(() => fetchRef.current(), []);

  useEffect(() => {
    // Refresh on any route change so a quick View -> Back flow still picks up
    // the latest read state even if the previous route was left immediately.
    const timeout = window.setTimeout(() => {
      void fetchRef.current();
    }, 150);

    return () => window.clearTimeout(timeout);
  }, [pathname]);

  useEffect(() => {
    const handleRefresh = () => {
      void fetchRef.current();
    };

    const handleMarkRead = (event: Event) => {
      const detail = (event as CustomEvent<SidebarMarkReadDetail>).detail;
      if (!detail?.id) return;

      const seen = readSeenState();
      const seenAt = detail.seenAt ?? new Date().toISOString();
      if (detail.entityType === 'quote') {
        seen.quotes[detail.id] = seenAt;
      } else {
        seen.invoices[detail.id] = seenAt;
      }
      writeSeenState(seen);
      setBadges(computeCounts(itemsRef.current, seen));
    };

    window.addEventListener('sidebar-badges:refresh', handleRefresh);
    window.addEventListener('sidebar-badges:mark-read', handleMarkRead as EventListener);
    return () => {
      window.removeEventListener('sidebar-badges:refresh', handleRefresh);
      window.removeEventListener('sidebar-badges:mark-read', handleMarkRead as EventListener);
    };
  }, []);

  return { badges, refresh };
}
