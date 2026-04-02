'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { Loader2Icon } from 'lucide-react';

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    async function logout() {
      try {
        await fetch('/api/logout', { method: 'POST' });
      } finally {
        router.replace('/login');
      }
    }

    logout();
  }, [router]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 pb-[var(--app-safe-area-bottom)]">
      <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
        <Loader2Icon className="size-4 animate-spin" />
        Logging out...
      </div>
    </div>
  );
}
