'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

export interface AdminSidebarBadges {
  companies: {
    suspended: number;
  };
  logs: {
    failedAccess: number;
  };
}

interface AdminSidebarBadgesPayload {
  companies?: {
    suspendedCount?: number;
  };
  logs?: {
    failedAccessCount?: number;
  };
}

const EMPTY_BADGES: AdminSidebarBadges = {
  companies: { suspended: 0 },
  logs: { failedAccess: 0 },
};

function normalizeBadges(payload?: AdminSidebarBadgesPayload): AdminSidebarBadges {
  return {
    companies: {
      suspended: Math.max(0, Number(payload?.companies?.suspendedCount || 0)),
    },
    logs: {
      failedAccess: Math.max(0, Number(payload?.logs?.failedAccessCount || 0)),
    },
  };
}

export function useAdminSidebarBadges() {
  const [badges, setBadges] = useState<AdminSidebarBadges>(EMPTY_BADGES);
  const fetchRef = useRef<() => Promise<void>>(async () => {});
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;

    async function fetchBadges() {
      try {
        const response = await fetch('/api/admin/sidebar/badges', { cache: 'no-store' });
        if (!response.ok || cancelled) {
          return;
        }

        const payload = (await response.json()) as { success?: boolean; data?: AdminSidebarBadgesPayload };
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