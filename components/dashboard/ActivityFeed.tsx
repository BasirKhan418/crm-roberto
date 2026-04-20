'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Users, Package, StickyNote, FileText, Activity, PlusIcon } from 'lucide-react';

import AddNoteModal from '@/components/modals/AddNoteModal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import EmptyState from '@/components/ui/EmptyState';
import ErrorMessage from '@/components/ui/ErrorMessage';
import { Skeleton } from '@/components/ui/skeleton';
import type { ActivityItem } from '@/hooks/useDashboard';
import {
  formatActivityRelativeTime,
  formatExactTimestamp,
  formatInvoiceDisplayNumber,
  getActivityHeadline,
  translate,
} from '@/lib/i18n/messages';
import { useLocale } from '@/components/providers/locale-provider';

const ENTITY_TO_PATH: Record<string, string> = {
  client: 'clients',
  supplier: 'suppliers',
  quote: 'quotes',
  invoice: 'invoices',
};

function buildActivityPath(item: ActivityItem): string | null {
  const isDeleted = item.action?.endsWith('_deleted');
  if (isDeleted) return null;
  const entityType = item.entityType;
  if (!entityType) return null;
  if (entityType === 'note') return '/notes';
  const basePath = ENTITY_TO_PATH[entityType];
  if (!basePath) return null;
  return item.entityId ? `/${basePath}/${item.entityId}` : `/${basePath}`;
}

const ENTITY_CONFIG = {
  client: {
    Icon: Users,
    iconBg: 'bg-indigo-100 dark:bg-indigo-900/50',
    iconText: 'text-indigo-700 dark:text-indigo-300',
    labelColor: 'text-indigo-700 dark:text-indigo-300',
  },
  supplier: {
    Icon: Package,
    iconBg: 'bg-amber-100 dark:bg-amber-900/50',
    iconText: 'text-amber-700 dark:text-amber-300',
    labelColor: 'text-amber-700 dark:text-amber-300',
  },
  note: {
    Icon: StickyNote,
    iconBg: 'bg-teal-100 dark:bg-teal-900/50',
    iconText: 'text-teal-700 dark:text-teal-300',
    labelColor: 'text-teal-700 dark:text-teal-300',
  },
  quote: {
    Icon: FileText,
    iconBg: 'bg-violet-100 dark:bg-violet-900/50',
    iconText: 'text-violet-700 dark:text-violet-300',
    labelColor: 'text-violet-700 dark:text-violet-300',
  },
} as const;

const DEFAULT_ENTITY = {
  Icon: Activity,
  iconBg: 'bg-slate-100 dark:bg-slate-800',
  iconText: 'text-slate-600 dark:text-slate-400',
  labelColor: 'text-slate-600 dark:text-slate-400',
};

interface ActivityFeedProps {
  activity?: ActivityItem[];
  loading?: boolean;
  error?: string | null;
  onActionSuccess?: () => void;
}

export default function ActivityFeed({ activity = [], loading = false, error = null, onActionSuccess }: ActivityFeedProps) {
  const { locale } = useLocale();
  const [isAddNoteOpen, setIsAddNoteOpen] = useState(false);
  const t = {
    title: translate(locale, 'activity.title'),
    empty: translate(locale, 'activity.empty'),
    addNote: locale === 'fr' ? 'Ajouter une note' : 'Add Note',
  };
  const items = Array.isArray(activity) ? activity : [];
  const pagedItems = items.slice(0, 5);
  const showError = Boolean(error) && items.length === 0;

  return (
    <>
      <Card className="flex h-full flex-col gap-0 overflow-hidden">
      <CardHeader className="border-b bg-slate-50 px-5 py-3.5 dark:bg-slate-900/40">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
            {t.title}
          </CardTitle>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            data-tour-dashboard-add-note
            className="h-7 rounded-full px-2.5 text-[11px] font-semibold"
            onClick={() => setIsAddNoteOpen(true)}
          >
            <PlusIcon className="size-3.5" strokeWidth={2.2} />
            <span className="hidden sm:inline">{t.addNote}</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col overflow-hidden px-0 pt-0">
        <div className="flex-1 divide-y divide-border/60 overflow-y-auto">
          {showError ? (
            <div className="px-5 py-4">
              <ErrorMessage message={error ?? undefined} />
            </div>
          ) : null}

          {loading &&
            [1, 2, 3, 4, 5, 6].map((index) => (
              <div key={index} className="flex items-start gap-3 px-5 py-3.5">
                <Skeleton className="mt-0.5 size-8 shrink-0 rounded-full" style={{ opacity: 1 - index * 0.1 }} />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-36" style={{ opacity: 1 - index * 0.1 }} />
                  <Skeleton className="h-3 w-24" style={{ opacity: 1 - index * 0.12 }} />
                </div>
                <Skeleton className="h-3 w-12 shrink-0" style={{ opacity: 0.5 - index * 0.05 }} />
              </div>
            ))}

          {!loading &&
            pagedItems.map((item, index) => {
              const entityCfg = ENTITY_CONFIG[item.entityType as keyof typeof ENTITY_CONFIG] ?? DEFAULT_ENTITY;
              const headline = item.action
                ? getActivityHeadline(locale, item.action)
                : translate(locale, 'activity.fallbackHeadline');
              const entityName = item.entityType === 'invoice' && item.entityName
                ? formatInvoiceDisplayNumber(locale, item.entityName)
                : item.entityName;
              const isDeleted = item.action?.endsWith('_deleted');
              const path = buildActivityPath(item);
              const key = item._id ?? `${item.createdAt ?? 'activity'}-${index}`;
              const rowClasses = `flex items-start gap-3.5 px-5 py-3.5 transition-colors hover:bg-muted/30${path ? ' cursor-pointer' : ''}`;

              const rowInner = (
                <>
                  <div className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ${entityCfg.iconBg}`}>
                    <entityCfg.Icon className={`size-4 ${entityCfg.iconText}`} strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-medium leading-tight ${isDeleted ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                      {headline}
                    </p>
                    {entityName ? (
                      <p className={`mt-0.5 truncate text-xs font-semibold ${entityCfg.labelColor}`}>
                        {entityName}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span
                      className="text-[11px] text-muted-foreground"
                      title={formatExactTimestamp(locale, item.createdAt)}
                    >
                      {formatActivityRelativeTime(locale, item.createdAt)}
                    </span>
                  </div>
                </>
              );

              return path ? (
                <Link key={key} href={path} className={rowClasses}>
                  {rowInner}
                </Link>
              ) : (
                <div key={key} className={rowClasses}>
                  {rowInner}
                </div>
              );
            })}

          {!loading && !showError && items.length === 0 ? (
            <div className="px-5 py-4">
              <EmptyState message={t.empty} />
            </div>
          ) : null}
        </div>

        {items.length > 5 ? <div className="px-5 py-2 text-[11px] text-muted-foreground">+{items.length - 5} more items</div> : null}
      </CardContent>
      </Card>
      {isAddNoteOpen ? <AddNoteModal onClose={() => setIsAddNoteOpen(false)} onSuccess={onActionSuccess} /> : null}
    </>
  );
}