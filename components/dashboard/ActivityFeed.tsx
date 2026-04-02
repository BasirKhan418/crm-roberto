'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Users, Package, StickyNote, FileText, Activity, ChevronLeft, ChevronRight } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import EmptyState from '@/components/ui/EmptyState';
import ErrorMessage from '@/components/ui/ErrorMessage';
import { Skeleton } from '@/components/ui/skeleton';
import type { ActivityItem } from '@/hooks/useDashboard';
import { useLocale } from '@/components/providers/locale-provider';

const ENTITY_TO_PATH: Record<string, string> = {
  client: 'clients',
  supplier: 'suppliers',
  quote: 'quotes',
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

type ActionBadge = { label: string; labelFr: string; badgeClass: string };

const ACTION_BADGE: Record<string, ActionBadge> = {
  client_created: { label: 'Created', labelFr: 'Créé', badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  client_updated: { label: 'Updated', labelFr: 'Modifié', badgeClass: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300' },
  client_deleted: { label: 'Deleted', labelFr: 'Supprimé', badgeClass: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300' },
  supplier_created: { label: 'Created', labelFr: 'Créé', badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  supplier_updated: { label: 'Updated', labelFr: 'Modifié', badgeClass: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300' },
  supplier_deleted: { label: 'Deleted', labelFr: 'Supprimé', badgeClass: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300' },
  note_created: { label: 'Created', labelFr: 'Créée', badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  note_updated: { label: 'Updated', labelFr: 'Modifiée', badgeClass: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300' },
  note_deleted: { label: 'Deleted', labelFr: 'Supprimée', badgeClass: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300' },
  quote_created: { label: 'Created', labelFr: 'Créé', badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  quote_duplicated: { label: 'Duplicated', labelFr: 'Dupliqué', badgeClass: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300' },
  quote_updated: { label: 'Updated', labelFr: 'Modifié', badgeClass: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300' },
  quote_deleted: { label: 'Deleted', labelFr: 'Supprimé', badgeClass: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300' },
  quote_status_changed: { label: 'Status Changed', labelFr: 'Statut modifié', badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
};

const ACTION_HEADLINE: Record<'en' | 'fr', Record<string, string>> = {
  en: {
    client_created: 'Client added',
    client_updated: 'Client updated',
    client_deleted: 'Client removed',
    supplier_created: 'Supplier added',
    supplier_updated: 'Supplier updated',
    supplier_deleted: 'Supplier removed',
    note_created: 'Note created',
    note_updated: 'Note updated',
    note_deleted: 'Note deleted',
    quote_created: 'Quote created',
    quote_duplicated: 'Quote duplicated',
    quote_updated: 'Quote updated',
    quote_deleted: 'Quote deleted',
    quote_status_changed: 'Quote status changed',
  },
  fr: {
    client_created: 'Client ajouté',
    client_updated: 'Client mis à jour',
    client_deleted: 'Client supprimé',
    supplier_created: 'Fournisseur ajouté',
    supplier_updated: 'Fournisseur mis à jour',
    supplier_deleted: 'Fournisseur supprimé',
    note_created: 'Note créée',
    note_updated: 'Note mise à jour',
    note_deleted: 'Note supprimée',
    quote_created: 'Devis créé',
    quote_duplicated: 'Devis dupliqué',
    quote_updated: 'Devis mis à jour',
    quote_deleted: 'Devis supprimé',
    quote_status_changed: 'Statut du devis modifié',
  },
};

interface ActivityFeedProps {
  activity?: ActivityItem[];
  loading?: boolean;
  error?: string | null;
}

function relativeTime(dateString?: string): string {
  if (!dateString) return '--';
  const timestamp = new Date(dateString).getTime();
  if (!Number.isFinite(timestamp)) return '--';
  const diffMs = Date.now() - timestamp;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  if (mins < 2880) return 'Yesterday';
  return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function exactTimestamp(dateString?: string): string {
  if (!dateString) return '';
  const d = new Date(dateString);
  if (!Number.isFinite(d.getTime())) return '';
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ActivityFeed({ activity = [], loading = false, error = null }: ActivityFeedProps) {
  const { locale } = useLocale();
  const t = {
    en: { title: 'Recent Activity', empty: 'No activity yet. Add your first client to get started.' },
    fr: { title: 'Activité Récente', empty: 'Aucune activité pour le moment. Ajoutez votre premier client pour commencer.' },
  }[locale];
  const items = Array.isArray(activity) ? activity : [];
  const PAGE_SIZE = 5;
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedItems = items.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const showError = Boolean(error) && items.length === 0;

  return (
    <Card className="flex h-full flex-col gap-0 overflow-hidden">
      <CardHeader className="border-b bg-slate-50 px-5 py-3.5 dark:bg-slate-900/40">
        <CardTitle className="text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
          {t.title}
        </CardTitle>
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
              const badge = item.action ? ACTION_BADGE[item.action] : null;
              const headline = item.action
                ? (ACTION_HEADLINE[locale as 'en' | 'fr'][item.action] ?? item.action)
                : 'Activity';
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
                    {item.entityName ? (
                      <p className={`mt-0.5 truncate text-xs font-semibold ${entityCfg.labelColor}`}>
                        {item.entityName}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {badge ? (
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badge.badgeClass}`}>
                        {locale === 'fr' ? badge.labelFr : badge.label}
                      </span>
                    ) : null}
                    <span
                      className="text-[11px] text-muted-foreground"
                      title={exactTimestamp(item.createdAt)}
                    >
                      {relativeTime(item.createdAt)}
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

        {!loading && !showError && totalPages > 1 ? (
          <div className="flex shrink-0 items-center justify-between border-t border-border/60 px-5 py-3">
            <span className="text-[11px] text-muted-foreground">
              {safePage} / {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="flex size-7 items-center justify-center rounded-md border border-border/60 text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="size-3.5" />
              </button>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="flex size-7 items-center justify-center rounded-md border border-border/60 text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronRight className="size-3.5" />
              </button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}