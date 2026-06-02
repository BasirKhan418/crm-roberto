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

interface AdminSidebarSeenState {
  companies?: number;
  logs?: number;
}

const ADMIN_SIDEBAR_SEEN_STORAGE_KEY = 'crm.admin.sidebar.badges.seen.v1';

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

function readSeenState(): AdminSidebarSeenState {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(ADMIN_SIDEBAR_SEEN_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as AdminSidebarSeenState;
    return {
      companies: Number.isFinite(parsed.companies) ? Number(parsed.companies) : undefined,
      logs: Number.isFinite(parsed.logs) ? Number(parsed.logs) : undefined,
    };
  } catch {
    return {};
  }
}

function writeSeenState(next: AdminSidebarSeenState) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(ADMIN_SIDEBAR_SEEN_STORAGE_KEY, JSON.stringify(next));
}

function applySeenState(raw: AdminSidebarBadges, seen: AdminSidebarSeenState): AdminSidebarBadges {
  return {
    companies: {
      suspended: Math.max(0, raw.companies.suspended - Math.max(0, Number(seen.companies || 0))),
    },
    logs: {
      failedAccess: Math.max(0, raw.logs.failedAccess - Math.max(0, Number(seen.logs || 0))),
    },
  };
}

export function useAdminSidebarBadges() {
  const [badges, setBadges] = useState<AdminSidebarBadges>(EMPTY_BADGES);
  const fetchRef = useRef<() => Promise<void>>(async () => {});
  const rawBadgesRef = useRef<AdminSidebarBadges>(EMPTY_BADGES);
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

    window.addEventListener('admin-sidebar-badges:refresh', handleRefresh as EventListener);
    window.addEventListener('focus', handleFocus);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener('admin-sidebar-badges:refresh', handleRefresh as EventListener);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  useEffect(() => {
    const seen = readSeenState();
    let changed = false;

    if (pathname.startsWith('/admin/companies')) {
      const latest = rawBadgesRef.current.companies.suspended;
      if (seen.companies !== latest) {
        seen.companies = latest;
        changed = true;
      }
    }

    if (pathname.startsWith('/admin/logs')) {
      const latest = rawBadgesRef.current.logs.failedAccess;
      if (seen.logs !== latest) {
        seen.logs = latest;
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