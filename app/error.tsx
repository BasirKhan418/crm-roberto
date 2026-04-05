'use client';

import { useEffect } from 'react';

import { AlertTriangleIcon, RefreshCwIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('App route error:', error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl rounded-2xl border border-red-200 bg-red-50/50 p-6 shadow-sm dark:border-red-900/50 dark:bg-red-950/20">
        <div className="mb-3 flex items-center gap-2 text-red-700 dark:text-red-300">
          <AlertTriangleIcon className="size-5" />
          <h2 className="text-base font-semibold">Unable to load this page</h2>
        </div>

        <p className="text-sm text-red-800/80 dark:text-red-200/80">
          Something went wrong while loading this content. Please try again.
        </p>

        {error?.message ? (
          <p className="mt-3 rounded-md bg-white/70 px-3 py-2 text-xs text-red-900/80 dark:bg-black/20 dark:text-red-100/80">
            {error.message}
          </p>
        ) : null}

        <div className="mt-5 flex items-center gap-2">
          <Button type="button" onClick={reset}>
            <RefreshCwIcon className="size-4" />
            Retry
          </Button>
        </div>
      </div>
    </div>
  );
}
