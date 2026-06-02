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

export function useAccountantSidebarBadges() {
  const [badges, setBadges] = useState<AccountantSidebarBadges>(EMPTY_BADGES);
  const fetchRef = useRef<() => Promise<void>>(async () => {});
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

        setBadges(normalizeBadges(payload.data));
      } catch {
        // Keep the last known counts on transient errors.
      }
    }

    fetchRef.current = fetchBadges;
    void fetchBadges();

    const intervalId = window.setInterval(() => {
      void fetchBadges();
    }, 60_000);

    const handleFocus = () => {
      void fetchBadges();
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void fetchRef.current();
    }, 150);

    return () => window.clearTimeout(timeout);
  }, [pathname]);

  const refresh = useCallback(() => fetchRef.current(), []);

  return { badges, refresh };
}