'use client';

import type { CompanyFeatureFlags } from '@/lib/company-features';
import type { ModulePermissionsMap } from '@/lib/permissions';
import { AUTH_REFRESH_EVENT, AUTH_REFRESH_STORAGE_KEY } from '@/lib/auth-refresh';
import { useCallback, useEffect, useRef, useState } from 'react';

const AUTH_REVALIDATE_INTERVAL_MS = 30000;

interface AuthUser {
  id: string;
  name: string;
  email: string;
  locale?: 'en' | 'fr';
  isOnboardingComplete?: boolean;
  role?: string;
  companyId?: string | null;
  featureFlags?: CompanyFeatureFlags;
  modulePermissions?: ModulePermissionsMap;
}

interface UseAuthMeResult {
  user: AuthUser | null;
  loading: boolean;
}

export function useAuthMe(): UseAuthMeResult {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const requestIdRef = useRef(0);
  const mountedRef = useRef(false);

  const loadMe = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent === true;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    if (!silent) {
      setLoading(true);
    }

    const controller = new AbortController();

    try {
      const response = await fetch('/api/me', {
        signal: controller.signal,
        cache: 'no-store',
      });

      if (!mountedRef.current || requestId !== requestIdRef.current) {
        return;
      }

      if (!response.ok) {
        setUser(null);
        return;
      }

      const data = (await response.json()) as { user?: AuthUser };
      setUser(data.user ?? null);
    } catch {
      if (!mountedRef.current || requestId !== requestIdRef.current) {
        return;
      }

      setUser(null);
    } finally {
      if (!silent && mountedRef.current && requestId === requestIdRef.current) {
        setLoading(false);
      }
    }

    return () => controller.abort();
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    void loadMe();

    function handleAuthRefresh() {
      void loadMe({ silent: true });
    }

    function handleWindowFocus() {
      void loadMe({ silent: true });
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        void loadMe({ silent: true });
      }
    }

    function handleStorage(event: StorageEvent) {
      if (event.key === AUTH_REFRESH_STORAGE_KEY && event.newValue) {
        void loadMe({ silent: true });
      }
    }

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void loadMe({ silent: true });
      }
    }, AUTH_REVALIDATE_INTERVAL_MS);

    window.addEventListener(AUTH_REFRESH_EVENT, handleAuthRefresh);
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('storage', handleStorage);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      mountedRef.current = false;
      requestIdRef.current += 1;
      window.clearInterval(intervalId);
      window.removeEventListener(AUTH_REFRESH_EVENT, handleAuthRefresh);
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('storage', handleStorage);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadMe]);

  return { user, loading };
}
