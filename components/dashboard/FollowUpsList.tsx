'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { CalendarClock, Users, Package, Clock, CalendarCheck, Calendar, CheckCircle2, Loader2, ChevronLeft, ChevronRight, PlusIcon } from 'lucide-react';

import AddNoteModal from '@/components/modals/AddNoteModal';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/ui/EmptyState';
import ErrorMessage from '@/components/ui/ErrorMessage';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useLocale } from '@/components/providers/locale-provider';
import type { FollowUpItem } from '@/hooks/useDashboard';

interface FollowUpsListProps {
  followUps?: FollowUpItem[];
  loading?: boolean;
  error?: string | null;
  onMarkDone?: () => void;
  onActionSuccess?: () => void;
}

function getStartOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

type Urgency = 'overdue-critical' | 'overdue-recent' | 'overdue-mild' | 'today' | 'tomorrow' | 'upcoming';

function getUrgency(dateStr?: string, referenceNow?: number): Urgency {
  if (!dateStr) return 'upcoming';
  const date = new Date(dateStr);
  const dateTime = date.getTime();
  if (!Number.isFinite(dateTime)) return 'upcoming';

  const now = referenceNow ?? Date.now();
  const todayStart = getStartOfDay(new Date(now));
  const tomorrowStart = todayStart + 86400000;
  const targetStart = getStartOfDay(date);

  if (targetStart < todayStart) {
    const daysOverdue = Math.round((todayStart - targetStart) / 86400000);
    if (daysOverdue > 30) return 'overdue-critical';
    if (daysOverdue > 7) return 'overdue-recent';
    return 'overdue-mild';
  }
  if (targetStart === todayStart) return 'today';
  if (targetStart === tomorrowStart) return 'tomorrow';
  return 'upcoming';
}

function getDaysOverdue(dateStr: string, referenceNow: number): number {
  const targetStart = getStartOfDay(new Date(dateStr));
  const todayStart = getStartOfDay(new Date(referenceNow));
  return Math.round((todayStart - targetStart) / 86400000);
}

function getDaysUntil(dateStr: string, referenceNow: number): number {
  const targetStart = getStartOfDay(new Date(dateStr));
  const todayStart = getStartOfDay(new Date(referenceNow));
  return Math.round((targetStart - todayStart) / 86400000);
}

function formatShortDate(dateStr: string | undefined, locale: 'en' | 'fr'): string {
  if (!dateStr) return '--';
  const d = new Date(dateStr);
  if (!Number.isFinite(d.getTime())) return '--';
  return d.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
}

function buildLinkedPath(item: FollowUpItem): string {
  const linkedType = item.linkedType === 'client' ? 'clients' : 'suppliers';
  const linkedId = item.linkedId?._id;
  return linkedId ? `/${linkedType}/${linkedId}` : `/${linkedType}`;
}

type UrgencyConfig = {
  iconBg: string;
  iconColor: string;
  Icon: React.ElementType;
  rowBg: string;
  dateLine: string;
  statusBg: string;
  statusText: string;
};

const URGENCY_STYLE: Record<Urgency, UrgencyConfig> = {
  'overdue-critical': {
    iconBg: 'bg-red-100 dark:bg-red-900/40',
    iconColor: 'text-red-700 dark:text-red-400',
    Icon: Clock,
    rowBg: '',
    dateLine: 'text-red-700 dark:text-red-400',
    statusBg: 'bg-red-700',
    statusText: 'text-white',
  },
  'overdue-recent': {
    iconBg: 'bg-orange-100 dark:bg-orange-900/40',
    iconColor: 'text-orange-600 dark:text-orange-400',
    Icon: Clock,
    rowBg: '',
    dateLine: 'text-orange-600 dark:text-orange-400',
    statusBg: 'bg-orange-500',
    statusText: 'text-white',
  },
  'overdue-mild': {
    iconBg: 'bg-amber-100 dark:bg-amber-900/40',
    iconColor: 'text-amber-600 dark:text-amber-400',
    Icon: Clock,
    rowBg: '',
    dateLine: 'text-amber-600 dark:text-amber-400',
    statusBg: 'bg-amber-500',
    statusText: 'text-white',
  },
  today: {
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/40',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    Icon: CalendarCheck,
    rowBg: 'bg-emerald-50/50 dark:bg-emerald-950/10',
    dateLine: 'text-emerald-600 dark:text-emerald-400',
    statusBg: 'bg-emerald-600',
    statusText: 'text-white',
  },
  tomorrow: {
    iconBg: 'bg-violet-100 dark:bg-violet-900/40',
    iconColor: 'text-violet-600 dark:text-violet-400',
    Icon: CalendarClock,
    rowBg: '',
    dateLine: 'text-violet-600 dark:text-violet-400',
    statusBg: 'bg-violet-600',
    statusText: 'text-white',
  },
  upcoming: {
    iconBg: 'bg-slate-100 dark:bg-slate-800',
    iconColor: 'text-slate-500 dark:text-slate-400',
    Icon: Calendar,
    rowBg: '',
    dateLine: 'text-slate-500 dark:text-slate-400',
    statusBg: 'bg-slate-500 dark:bg-slate-600',
    statusText: 'text-white',
  },
};

function getStatusLabel(
  urgency: Urgency,
  item: FollowUpItem,
  referenceNow: number,
  locale: 'en' | 'fr',
  labels: {
    overdueMonths: (count: number) => string;
    overdueWeeks: (count: number) => string;
    overdueDays: (count: number) => string;
    dueToday: string;
    tomorrow: string;
    inWeeks: (count: number) => string;
    inDays: (count: number) => string;
  },
): { main: string; sub: string } {
  const dateStr = item.followUpDate ?? '';

  if (urgency === 'overdue-critical' || urgency === 'overdue-recent' || urgency === 'overdue-mild') {
    const days = getDaysOverdue(dateStr, referenceNow);
    const weeks = Math.floor(days / 7);
    const months = Math.floor(days / 30);
    const sub = formatShortDate(dateStr, locale);
    if (months >= 1) return { main: labels.overdueMonths(months), sub };
    if (weeks >= 1) return { main: labels.overdueWeeks(weeks), sub };
    return { main: labels.overdueDays(days), sub };
  }

  if (urgency === 'today') return { main: labels.dueToday, sub: formatShortDate(dateStr, locale) };
  if (urgency === 'tomorrow') return { main: labels.tomorrow, sub: formatShortDate(dateStr, locale) };

  const days = getDaysUntil(dateStr, referenceNow);
  const weeks = Math.floor(days / 7);
  if (weeks >= 1) return { main: labels.inWeeks(weeks), sub: formatShortDate(dateStr, locale) };
  return { main: labels.inDays(days), sub: formatShortDate(dateStr, locale) };
}

function SectionDivider({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className={`flex items-center gap-2 px-5 py-2 ${color}`}>
      <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
      <span className="rounded-full bg-current/15 px-1.5 py-0.5 text-[10px] font-bold">{count}</span>
    </div>
  );
}

export default function FollowUpsList({ followUps = [], loading = false, error = null, onMarkDone, onActionSuccess }: FollowUpsListProps) {
  const { locale } = useLocale();
  const t = {
    en: {
      title: 'Follow-Ups',
      overdue: 'Overdue',
      scheduled: 'Scheduled',
      empty: 'No follow-ups scheduled. Add a follow-up date to any note.',
      untitled: 'Untitled follow-up',
      unknown: 'Unknown',
      markAsDone: 'Mark as done',
      overdueMonths: (count: number) => `${count}mo overdue`,
      overdueWeeks: (count: number) => `${count}w overdue`,
      overdueDays: (count: number) => `${count}d overdue`,
      dueToday: 'Due today',
      tomorrow: 'Tomorrow',
      inWeeks: (count: number) => `In ${count}w`,
      inDays: (count: number) => `In ${count}d`,
      addNote: 'Add Note',
    },
    fr: {
      title: 'Suivis',
      overdue: 'En retard',
      scheduled: 'Programm\u00e9s',
      empty: 'Aucun suivi programm\u00e9. Ajoutez une date de suivi \u00e0 une note.',
      untitled: 'Suivi sans titre',
      unknown: 'Inconnu',
      markAsDone: 'Marquer comme termin\u00e9',
      overdueMonths: (count: number) => `${count} mois de retard`,
      overdueWeeks: (count: number) => `${count} sem de retard`,
      overdueDays: (count: number) => `${count} j de retard`,
      dueToday: "Pour aujourd'hui",
      tomorrow: 'Demain',
      inWeeks: (count: number) => `Dans ${count} sem`,
      inDays: (count: number) => `Dans ${count} j`,
      addNote: 'Ajouter une note',
    },
  }[locale];

  const PAGE_SIZE = 5;
  const [referenceNow] = useState<number>(() => Date.now());
  const [doneIds, setDoneIds] = useState<Set<string>>(() => new Set());
  const [markingIds, setMarkingIds] = useState<Set<string>>(() => new Set());
  const [page, setPage] = useState(1);
  const [isAddNoteOpen, setIsAddNoteOpen] = useState(false);

  async function markDone(id: string) {
    setDoneIds((prev) => new Set(prev).add(id));
    setMarkingIds((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/notes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ followUpDate: null }),
      });
      if (!res.ok) throw new Error('Failed');
      onMarkDone?.();
    } catch {
      // Revert optimistic removal on failure
      setDoneIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    } finally {
      setMarkingIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    }
  }

  const allItems = (Array.isArray(followUps) ? followUps : []).filter((item) => {
    const dateTime = item.followUpDate ? new Date(item.followUpDate).getTime() : Number.NaN;
    return Number.isFinite(dateTime) && !doneIds.has(item._id ?? '');
  });

  // Split into overdue (sorted: most recent overdue first — most actionable) and upcoming (soonest first)
  const overdueItems = allItems
    .filter((item) => {
      const u = getUrgency(item.followUpDate, referenceNow);
      return u === 'overdue-critical' || u === 'overdue-recent' || u === 'overdue-mild';
    })
    .sort((a, b) => new Date(b.followUpDate ?? 0).getTime() - new Date(a.followUpDate ?? 0).getTime());

  const scheduledItems = allItems
    .filter((item) => {
      const u = getUrgency(item.followUpDate, referenceNow);
      return u === 'today' || u === 'tomorrow' || u === 'upcoming';
    })
    .sort((a, b) => new Date(a.followUpDate ?? 0).getTime() - new Date(b.followUpDate ?? 0).getTime());

  // Combined ordered list for pagination: overdue first, then scheduled
  const combinedItems = [...overdueItems, ...scheduledItems];
  const totalPages = Math.max(1, Math.ceil(combinedItems.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedItems = combinedItems.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const pagedOverdue = pagedItems.filter((item) => {
    const u = getUrgency(item.followUpDate, referenceNow);
    return u === 'overdue-critical' || u === 'overdue-recent' || u === 'overdue-mild';
  });
  const pagedScheduled = pagedItems.filter((item) => {
    const u = getUrgency(item.followUpDate, referenceNow);
    return u === 'today' || u === 'tomorrow' || u === 'upcoming';
  });

  const showError = Boolean(error) && allItems.length === 0;

  function FollowUpRow({ item }: { item: FollowUpItem }) {
    const router = useRouter();
    const urgency = getUrgency(item.followUpDate, referenceNow);
    const cfg = URGENCY_STYLE[urgency];
    const { main, sub } = getStatusLabel(urgency, item, referenceNow, locale, t);
    const id = item._id ?? '';
    const isMarking = markingIds.has(id);
    const linkedPath = buildLinkedPath(item);

    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => router.push(linkedPath)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') router.push(linkedPath); }}
        className={`group flex cursor-pointer items-start gap-3.5 px-5 py-3 transition-colors hover:bg-muted/30 ${cfg.rowBg}`}
      >
        <div className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ${cfg.iconBg}`}>
          <cfg.Icon className={`size-4 ${cfg.iconColor}`} strokeWidth={1.75} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            {item.title ?? t.untitled}
          </p>
          <Link
            href={buildLinkedPath(item)}
            className={`mt-1 inline-flex max-w-40 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors ${
              item.linkedType === 'client'
                ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300'
                : 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-300'
            }`}
          >
            {item.linkedType === 'client' ? (
              <Users className="size-2.5 shrink-0" strokeWidth={2} />
            ) : (
              <Package className="size-2.5 shrink-0" strokeWidth={2} />
            )}
            <span className="truncate">{item.linkedId?.fullName ?? t.unknown}</span>
          </Link>
        </div>

        <div className="flex shrink-0 items-start gap-2">
          <button
            type="button"
            title={t.markAsDone}
            disabled={isMarking || !id}
            onClick={(e) => { e.stopPropagation(); if (id) markDone(id); }}
            className="mt-0.5 flex size-7 items-center justify-center rounded-full border border-transparent text-muted-foreground/40 opacity-0 transition-all hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-600 group-hover:opacity-100 disabled:cursor-not-allowed dark:hover:bg-emerald-950/30 dark:hover:text-emerald-400"
          >
            {isMarking ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="size-3.5" strokeWidth={2} />
            )}
          </button>
          <div className="text-right">
            <span className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold ${cfg.statusBg} ${cfg.statusText}`}>
              {main}
            </span>
            <p className={`mt-0.5 text-[10px] ${cfg.dateLine}`}>{sub}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Card className="flex h-full flex-col gap-0 overflow-hidden pt-0">
      <CardHeader className="border-b bg-slate-50 px-5 py-3.5 dark:bg-slate-900/40">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
            {t.title}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              data-tour-dashboard-followup-add-note
              className="h-7 rounded-full px-2.5 text-[11px] font-semibold"
              onClick={() => setIsAddNoteOpen(true)}
            >
              <PlusIcon className="size-3.5" strokeWidth={2.2} />
              <span className="hidden sm:inline">{t.addNote}</span>
            </Button>
            {!loading && allItems.length > 0 ? (
              <>
              {overdueItems.length > 0 ? (
                <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white">
                  {locale === 'fr' ? `${overdueItems.length} en retard` : `${overdueItems.length} overdue`}
                </span>
              ) : null}
              {scheduledItems.length > 0 ? (
                <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">
                  {locale === 'fr' ? `${scheduledItems.length} à venir` : `${scheduledItems.length} upcoming`}
                </span>
              ) : null}
              </>
            ) : null}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col overflow-hidden px-0 pt-0">
        <div className="flex-1 divide-y divide-border/50 overflow-y-auto">
          {showError ? (
            <div className="px-5 py-4">
              <ErrorMessage message={error ?? undefined} />
            </div>
          ) : null}

          {loading && !showError
            ? [1, 2, 3, 4].map((index) => (
                <div key={index} className="flex items-start gap-3 px-5 py-3">
                  <Skeleton className="mt-0.5 size-8 shrink-0 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-40" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <div className="space-y-1">
                    <Skeleton className="h-5 w-20 rounded-full" />
                    <Skeleton className="h-3 w-14" />
                  </div>
                </div>
              ))
            : null}

          {!loading && !showError && allItems.length > 0 ? (
            <>
              {pagedOverdue.length > 0 ? (
                <>
                  <SectionDivider
                    label={t.overdue}
                    count={overdueItems.length}
                    color="bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400"
                  />
                  {pagedOverdue.map((item, index) => (
                    <FollowUpRow key={item._id ?? `overdue-${index}`} item={item} />
                  ))}
                </>
              ) : null}

              {pagedScheduled.length > 0 ? (
                <>
                  <SectionDivider
                    label={t.scheduled}
                    count={scheduledItems.length}
                    color="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400"
                  />
                  {pagedScheduled.map((item, index) => (
                    <FollowUpRow key={item._id ?? `scheduled-${index}`} item={item} />
                  ))}
                </>
              ) : null}
            </>
          ) : null}

          {!loading && !showError && allItems.length === 0 ? (
            <div className="px-5 py-4">
              <EmptyState message={t.empty} />
            </div>
          ) : null}
        </div>

        {!loading && !showError && totalPages > 1 ? (
          <div className="flex shrink-0 items-center justify-between border-t border-border/50 px-5 py-3">
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
      {isAddNoteOpen ? <AddNoteModal onClose={() => setIsAddNoteOpen(false)} onSuccess={onActionSuccess} /> : null}
    </>
  );
}
