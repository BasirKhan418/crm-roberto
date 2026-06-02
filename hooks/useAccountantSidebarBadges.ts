'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

export interface AccountantSidebarBadges {
  purchaseInvoices: {
    unpaid: number;
    overdue: number;
  };
  salesInvoices: {
    unpaid: number;
    overdue: number;
  };
  tickets: {
    unread: number;
    assignedOpen: number;
  };
}

interface AccountantSidebarBadgesPayload {
  purchaseInvoices?: {
    unpaidCount?: number;
    overdueCount?: number;
  };
  salesInvoices?: {
    unpaidCount?: number;
    overdueCount?: number;
  };
  tickets?: {
    unreadCount?: number;
    assignedOpenCount?: number;
  };
}

const EMPTY_BADGES: AccountantSidebarBadges = {
  purchaseInvoices: { unpaid: 0, overdue: 0 },
  salesInvoices: { unpaid: 0, overdue: 0 },
  tickets: { unread: 0, assignedOpen: 0 },
};

interface AccountantSidebarSeenState {
  purchaseInvoices?: {
    unpaid?: number;
    overdue?: number;
  };
  salesInvoices?: {
    unpaid?: number;
    overdue?: number;
  };
  tickets?: {
    unread?: number;
    assignedOpen?: number;
  };
}

const ACCOUNTANT_SIDEBAR_SEEN_STORAGE_KEY = 'crm.accountant.sidebar.badges.seen.v1';

function normalizeBadges(payload?: AccountantSidebarBadgesPayload): AccountantSidebarBadges {
  return {
    purchaseInvoices: {
      unpaid: Math.max(0, Number(payload?.purchaseInvoices?.unpaidCount || 0)),
      overdue: Math.max(0, Number(payload?.purchaseInvoices?.overdueCount || 0)),
    },
    salesInvoices: {
      unpaid: Math.max(0, Number(payload?.salesInvoices?.unpaidCount || 0)),
      overdue: Math.max(0, Number(payload?.salesInvoices?.overdueCount || 0)),
    },
    tickets: {
      unread: Math.max(0, Number(payload?.tickets?.unreadCount || 0)),
      assignedOpen: Math.max(0, Number(payload?.tickets?.assignedOpenCount || 0)),
    },
  };
}

function readSeenState(): AccountantSidebarSeenState {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(ACCOUNTANT_SIDEBAR_SEEN_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    return JSON.parse(raw) as AccountantSidebarSeenState;
  } catch {
    return {};
  }
}

function writeSeenState(next: AccountantSidebarSeenState) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(ACCOUNTANT_SIDEBAR_SEEN_STORAGE_KEY, JSON.stringify(next));
}

function toSeenCount(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function applySeenState(raw: AccountantSidebarBadges, seen: AccountantSidebarSeenState): AccountantSidebarBadges {
  return {
    purchaseInvoices: {
      unpaid: Math.max(0, raw.purchaseInvoices.unpaid - toSeenCount(seen.purchaseInvoices?.unpaid)),
      overdue: Math.max(0, raw.purchaseInvoices.overdue - toSeenCount(seen.purchaseInvoices?.overdue)),
    },
    salesInvoices: {
      unpaid: Math.max(0, raw.salesInvoices.unpaid - toSeenCount(seen.salesInvoices?.unpaid)),
      overdue: Math.max(0, raw.salesInvoices.overdue - toSeenCount(seen.salesInvoices?.overdue)),
    },
    tickets: {
      unread: Math.max(0, raw.tickets.unread - toSeenCount(seen.tickets?.unread)),
      assignedOpen: Math.max(0, raw.tickets.assignedOpen - toSeenCount(seen.tickets?.assignedOpen)),
    },
  };
}

export function useAccountantSidebarBadges() {
  const [badges, setBadges] = useState<AccountantSidebarBadges>(EMPTY_BADGES);
  const fetchRef = useRef<() => Promise<void>>(async () => {});
  const rawBadgesRef = useRef<AccountantSidebarBadges>(EMPTY_BADGES);
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;

    async function fetchBadges() {
      try {
        const response = await fetch('/api/accountant/sidebar/badges', { cache: 'no-store' });
        if (!response.ok || cancelled) {
          return;
        }

        const payload = (await response.json()) as { success?: boolean; data?: AccountantSidebarBadgesPayload };
        if (cancelled || !payload.success) {
          return;
        }

        rawBadgesRef.current = normalizeBadges(payload.data);
        setBadges(applySeenState(rawBadgesRef.current, readSeenState()));
      } catch {
        // Keep the last known counts on transient errors.
      }
    }

    fetchRef.current = fetchBadges;
    void fetchBadges();

    const intervalId = window.setInterval(() => {
      void fetchBadges();
    }, 60_000);

    const handleRefresh = () => {
      void fetchBadges();
    };

    const handleFocus = () => {
      void fetchBadges();
    };

    window.addEventListener('accountant-sidebar-badges:refresh', handleRefresh as EventListener);
    window.addEventListener('focus', handleFocus);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener('accountant-sidebar-badges:refresh', handleRefresh as EventListener);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  useEffect(() => {
    const seen = readSeenState();
    let changed = false;

    if (pathname.startsWith('/accountant-portal/purchase-invoices')) {
      const latest = rawBadgesRef.current.purchaseInvoices;
      const next = {
        unpaid: latest.unpaid,
        overdue: latest.overdue,
      };
      if (
        toSeenCount(seen.purchaseInvoices?.unpaid) !== next.unpaid ||
        toSeenCount(seen.purchaseInvoices?.overdue) !== next.overdue
      ) {
        seen.purchaseInvoices = next;
        changed = true;
      }
    }

    if (pathname.startsWith('/accountant-portal/sales-invoices')) {
      const latest = rawBadgesRef.current.salesInvoices;
      const next = {
        unpaid: latest.unpaid,
        overdue: latest.overdue,
      };
      if (
        toSeenCount(seen.salesInvoices?.unpaid) !== next.unpaid ||
        toSeenCount(seen.salesInvoices?.overdue) !== next.overdue
      ) {
        seen.salesInvoices = next;
        changed = true;
      }
    }

    if (pathname.startsWith('/accountant-portal/tickets')) {
      const latest = rawBadgesRef.current.tickets;
      const next = {
        unread: latest.unread,
        assignedOpen: latest.assignedOpen,
      };
      if (
        toSeenCount(seen.tickets?.unread) !== next.unread ||
        toSeenCount(seen.tickets?.assignedOpen) !== next.assignedOpen
      ) {
        seen.tickets = next;
        changed = true;
      }
    }

    if (changed) {
      writeSeenState(seen);
    }

    setBadges(applySeenState(rawBadgesRef.current, seen));

    const timeout = window.setTimeout(() => {
      void fetchRef.current();
    }, 150);

    return () => window.clearTimeout(timeout);
  }, [pathname]);

  const refresh = useCallback(() => fetchRef.current(), []);

  return { badges, refresh };
}