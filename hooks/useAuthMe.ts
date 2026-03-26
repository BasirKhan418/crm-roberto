'use client';

import { useEffect, useState } from 'react';

interface AuthUser {
  id: string;
  name: string;
  email: string;
  isOnboardingComplete?: boolean;
}

interface UseAuthMeResult {
  user: AuthUser | null;
  loading: boolean;
}

export function useAuthMe(): UseAuthMeResult {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const controller = new AbortController();

    async function loadMe() {
      try {
        const response = await fetch('/api/me', {
          signal: controller.signal,
          cache: 'no-store',
        });

        if (!response.ok) {
          setUser(null);
          return;
        }

        const data = (await response.json()) as { user?: AuthUser };
        setUser(data.user ?? null);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    loadMe();

    return () => controller.abort();
  }, []);

  return { user, loading };
}
