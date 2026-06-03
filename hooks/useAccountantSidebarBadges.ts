'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface AccountantSidebarBadges {
  purchaseInvoices: {
    toProcess: number;
  };
  salesInvoices: {
    toProcess: number;
  };
  tickets: {
    unread: number;
    assignedOpen: number;
  };
}

interface AccountantSidebarBadgesPayload {
  purchaseInvoices?: {
    toProcessCount?: number;
  };
  salesInvoices?: {
    toProcessCount?: number;
  };
  tickets?: {
    unreadCount?: number;
    assignedOpenCount?: number;
  };
}

const EMPTY_BADGES: AccountantSidebarBadges = {
  purchaseInvoices: { toProcess: 0 },
  salesInvoices: { toProcess: 0 },
  tickets: { unread: 0, assignedOpen: 0 },
};

function normalizeBadges(payload?: AccountantSidebarBadgesPayload): AccountantSidebarBadges {
  return {
    purchaseInvoices: {
      toProcess: Math.max(0, Number(payload?.purchaseInvoices?.toProcessCount || 0)),
    },
    salesInvoices: {
      toProcess: Math.max(0, Number(payload?.salesInvoices?.toProcessCount || 0)),
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

  const refresh = useCallback(() => fetchRef.current(), []);

  return { badges, refresh };
}