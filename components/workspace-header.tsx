'use client';

import type { ReactNode } from 'react';

import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

type WorkspaceHeaderProps = {
  title: string;
  description?: string;
  eyebrow?: string;
  statusBadge?: string;
  actions?: ReactNode;
  className?: string;
};

export function WorkspaceHeader({
  title,
  description,
  eyebrow,
  statusBadge,
  actions,
  className,
}: WorkspaceHeaderProps) {
  return (
    <header
      className={cn(
        'sticky top-0 z-20 shrink-0 border-b border-slate-200/80 bg-white/80 backdrop-blur-xl dark:border-slate-800/70 dark:bg-slate-950/70',
        className,
      )}
    >
      <div className="flex min-h-(--header-height) w-full flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:px-6">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="flex shrink-0 items-center gap-2 pt-0.5">
            <SidebarTrigger className="-ml-1 rounded-full border border-slate-200/80 bg-white shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900" />
            <Separator orientation="vertical" className="hidden h-6 lg:block" />
          </div>

          <div className="min-w-0 space-y-2">
            {eyebrow || statusBadge ? (
              <div className="flex flex-wrap items-center gap-2">
                {eyebrow ? (
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100/80 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-600 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300">
                    {eyebrow}
                  </span>
                ) : null}
                {statusBadge ? (
                  <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                    {statusBadge}
                  </span>
                ) : null}
              </div>
            ) : null}

            <div className="min-w-0 space-y-1">
              <h1 className="truncate text-lg font-semibold tracking-tight text-slate-950 dark:text-slate-50 sm:text-xl">
                {title}
              </h1>
              {description ? <p className="max-w-3xl text-sm text-muted-foreground">{description}</p> : null}
            </div>
          </div>
        </div>

        {actions ? <div className="flex shrink-0 items-center gap-2 self-stretch lg:self-auto">{actions}</div> : null}
      </div>
    </header>
  );
}