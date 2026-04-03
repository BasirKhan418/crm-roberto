'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { AlertTriangleIcon, ArrowRightIcon, CalendarCheckIcon, CalendarClockIcon, Clock3Icon, FileTextIcon, NotebookPenIcon, PlusIcon, ReceiptTextIcon } from 'lucide-react';

import AddNoteModal from '@/components/modals/AddNoteModal';
import { useLocale } from '@/components/providers/locale-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import EmptyState from '@/components/ui/EmptyState';
import ErrorMessage from '@/components/ui/ErrorMessage';
import { Skeleton } from '@/components/ui/skeleton';
import type { FollowUpItem } from '@/hooks/useDashboard';

const DAY_IN_MS = 86_400_000;

type PriorityTone = 'overdue' | 'today' | 'tomorrow' | 'upcoming';

interface PriorityActionsPanelProps {
  followUps?: FollowUpItem[];
  loading?: boolean;
  error?: string | null;
  onActionSuccess?: () => void;
}

interface PriorityItem {
  item: FollowUpItem;
  tone: PriorityTone;
  rank: number;
  timestamp: number;
  badge: string;
  badgeClass: string;
  dateLabel: string;
  iconBg: string;
  iconColor: string;
  Icon: React.ElementType;
}

function getStartOfDay(value: Date): number {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
}

function buildLinkedPath(item: FollowUpItem): string {
  const linkedType = item.linkedType === 'client' ? 'clients' : 'suppliers';
  const linkedId = item.linkedId?._id;
  return linkedId ? `/${linkedType}/${linkedId}` : `/${linkedType}`;
}

function formatShortDate(dateStr: string, locale: 'en' | 'fr'): string {
  const date = new Date(dateStr);
  if (!Number.isFinite(date.getTime())) {
    return '--';
  }

  return date.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB', {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
  });
}

function getPriorityItem(item: FollowUpItem, locale: 'en' | 'fr', labels: {
  overdue: (count: number) => string;
  dueToday: string;
  tomorrow: string;
  inDays: (count: number) => string;
}): PriorityItem | null {
  const followUpDate = item.followUpDate;
  if (!followUpDate) {
    return null;
  }

  const targetDate = new Date(followUpDate);
  const targetTime = targetDate.getTime();
  if (!Number.isFinite(targetTime)) {
    return null;
  }

  const todayStart = getStartOfDay(new Date());
  const targetStart = getStartOfDay(targetDate);
  const diffDays = Math.round((targetStart - todayStart) / DAY_IN_MS);
  const baseDateLabel = formatShortDate(followUpDate, locale);

  if (diffDays < 0) {
    const overdueDays = Math.abs(diffDays);
    return {
      item,
      tone: 'overdue',
      rank: 0,
      timestamp: targetStart,
      badge: labels.overdue(overdueDays),
      badgeClass: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300',
      dateLabel: baseDateLabel,
      iconBg: 'bg-red-100 dark:bg-red-950/40',
      iconColor: 'text-red-700 dark:text-red-300',
      Icon: AlertTriangleIcon,
    };
  }

  if (diffDays === 0) {
    return {
      item,
      tone: 'today',
      rank: 1,
      timestamp: targetStart,
      badge: labels.dueToday,
      badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
      dateLabel: baseDateLabel,
      iconBg: 'bg-emerald-100 dark:bg-emerald-950/40',
      iconColor: 'text-emerald-700 dark:text-emerald-300',
      Icon: CalendarCheckIcon,
    };
  }

  if (diffDays === 1) {
    return {
      item,
      tone: 'tomorrow',
      rank: 2,
      timestamp: targetStart,
      badge: labels.tomorrow,
      badgeClass: 'bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300',
      dateLabel: baseDateLabel,
      iconBg: 'bg-violet-100 dark:bg-violet-950/40',
      iconColor: 'text-violet-700 dark:text-violet-300',
      Icon: CalendarClockIcon,
    };
  }

  return {
    item,
    tone: 'upcoming',
    rank: 3,
    timestamp: targetStart,
    badge: labels.inDays(diffDays),
    badgeClass: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    dateLabel: baseDateLabel,
    iconBg: 'bg-slate-100 dark:bg-slate-800',
    iconColor: 'text-slate-600 dark:text-slate-300',
    Icon: Clock3Icon,
  };
}

function ActionTile({
  title,
  description,
  href,
  onClick,
  accentClass,
  plusClass,
  Icon,
}: {
  title: string;
  description: string;
  href?: string;
  onClick?: () => void;
  accentClass: string;
  plusClass: string;
  Icon: React.ElementType;
}) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className={`flex size-11 shrink-0 items-center justify-center rounded-2xl ${accentClass}`}>
          <Icon className="size-5" strokeWidth={1.9} />
        </div>
        <div className={`flex size-9 shrink-0 items-center justify-center rounded-full ${plusClass}`}>
          <PlusIcon className="size-4" strokeWidth={2.25} />
        </div>
      </div>
      <div className="mt-4 space-y-1.5">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs leading-5 text-muted-foreground">{description}</p>
      </div>
      <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-foreground/70 transition-transform group-hover:translate-x-0.5">
        <span>{title}</span>
        <ArrowRightIcon className="size-3.5" strokeWidth={2} />
      </div>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="group rounded-2xl border border-border/70 bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-border hover:shadow-md"
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="group rounded-2xl border border-border/70 bg-card p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-border hover:shadow-md"
    >
      {content}
    </button>
  );
}

export default function PriorityActionsPanel({
  followUps = [],
  loading = false,
  error = null,
  onActionSuccess,
}: PriorityActionsPanelProps) {
  const router = useRouter();
  const [isAddNoteOpen, setIsAddNoteOpen] = useState(false);
  const { locale } = useLocale();

  const t = {
    en: {
      kicker: 'Priority actions',
      title: 'Handle urgent work first',
      subtitle: 'Overdue notes and the next follow-ups are surfaced before the rest of the dashboard.',
      unknown: 'Unknown record',
      noPriority: 'No urgent follow-ups right now. Use a quick action to move the pipeline forward.',
      addNote: 'Add Note',
      addNoteDescription: 'Capture a follow-up or internal task before it slips.',
      createQuote: 'Create Quote',
      createQuoteDescription: 'Start a new quote directly from the dashboard.',
      createInvoice: 'Create Invoice',
      createInvoiceDescription: 'Open the invoice workspace to prepare billing.',
      overdueBadge: (count: number) => `${count} overdue`,
      dueTodayBadge: (count: number) => `${count} today`,
      overdue: (count: number) => `${count}d overdue`,
      dueToday: 'Due today',
      tomorrow: 'Tomorrow',
      inDays: (count: number) => `In ${count}d`,
    },
    fr: {
      kicker: 'Actions prioritaires',
      title: 'Traitez l urgent en premier',
      subtitle: 'Les notes en retard et les prochains suivis apparaissent avant le reste du tableau de bord.',
      unknown: 'Element inconnu',
      noPriority: 'Aucun suivi urgent pour le moment. Utilisez une action rapide pour faire avancer le pipeline.',
      addNote: 'Ajouter une note',
      addNoteDescription: 'Capturez un suivi ou une tache interne avant qu il ne disparaisse.',
      createQuote: 'Creer un devis',
      createQuoteDescription: 'Demarrez un nouveau devis directement depuis le tableau de bord.',
      createInvoice: 'Creer une facture',
      createInvoiceDescription: 'Ouvrez l espace factures pour preparer la facturation.',
      overdueBadge: (count: number) => `${count} en retard`,
      dueTodayBadge: (count: number) => `${count} aujourd hui`,
      overdue: (count: number) => `${count} j de retard`,
      dueToday: 'Pour aujourd hui',
      tomorrow: 'Demain',
      inDays: (count: number) => `Dans ${count} j`,
    },
  }[locale];

  const priorityItems = useMemo(() => {
    return (Array.isArray(followUps) ? followUps : [])
      .map((item) => getPriorityItem(item, locale, t))
      .filter((item): item is PriorityItem => item !== null)
      .sort((left, right) => {
        if (left.rank !== right.rank) {
          return left.rank - right.rank;
        }

        return left.timestamp - right.timestamp;
      })
      .slice(0, 4);
  }, [followUps, locale, t]);

  const overdueCount = priorityItems.filter((item) => item.tone === 'overdue').length;
  const todayCount = priorityItems.filter((item) => item.tone === 'today').length;
  const showError = Boolean(error) && priorityItems.length === 0;

  return (
    <section className="grid gap-4 xl:grid-cols-[1.45fr_1fr]">
      <Card className="gap-0 overflow-hidden border border-foreground/10">
        <CardHeader className="border-b bg-slate-50 px-5 py-4 dark:bg-slate-900/40">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                {t.kicker}
              </p>
              <CardTitle className="text-lg font-semibold text-foreground">{t.title}</CardTitle>
              <p className="max-w-2xl text-sm text-muted-foreground">{t.subtitle}</p>
            </div>

            {!loading && !showError ? (
              <div className="flex items-center gap-2">
                {overdueCount > 0 ? (
                  <span className="rounded-full bg-red-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                    {t.overdueBadge(overdueCount)}
                  </span>
                ) : null}
                {todayCount > 0 ? (
                  <span className="rounded-full bg-emerald-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                    {t.dueTodayBadge(todayCount)}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        </CardHeader>

        <CardContent className="px-0 pt-0">
          {showError ? (
            <div className="p-5">
              <ErrorMessage message={error ?? undefined} />
            </div>
          ) : null}

          {loading ? (
            <div className="divide-y divide-border/60">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={`priority-skeleton-${index}`} className="flex items-start gap-3 px-5 py-4">
                  <Skeleton className="size-9 shrink-0 rounded-2xl" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3.5 w-52" />
                  </div>
                  <div className="space-y-2 text-right">
                    <Skeleton className="ml-auto h-5 w-20 rounded-full" />
                    <Skeleton className="ml-auto h-3.5 w-14" />
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {!loading && !showError && priorityItems.length > 0 ? (
            <div className="divide-y divide-border/60">
              {priorityItems.map((priorityItem) => {
                const linkedName = priorityItem.item.linkedId?.fullName ?? t.unknown;

                return (
                  <Link
                    key={priorityItem.item._id ?? `${priorityItem.item.title}-${priorityItem.timestamp}`}
                    href={buildLinkedPath(priorityItem.item)}
                    className="group flex items-start gap-3 px-5 py-4 transition-colors hover:bg-muted/30"
                  >
                    <div className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-2xl ${priorityItem.iconBg}`}>
                      <priorityItem.Icon className={`size-4.5 ${priorityItem.iconColor}`} strokeWidth={1.9} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {priorityItem.item.title ?? t.addNote}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="truncate rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground/75">
                          {linkedName}
                        </span>
                        <span>{priorityItem.dateLabel}</span>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5 pl-2">
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${priorityItem.badgeClass}`}>
                        {priorityItem.badge}
                      </span>
                      <ArrowRightIcon className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" strokeWidth={2} />
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : null}

          {!loading && !showError && priorityItems.length === 0 ? (
            <div className="p-5">
              <EmptyState message={t.noPriority} />
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
        <ActionTile
          title={t.addNote}
          description={t.addNoteDescription}
          onClick={() => setIsAddNoteOpen(true)}
          accentClass="bg-teal-50 text-teal-700 dark:bg-teal-950/30 dark:text-teal-300"
          plusClass="bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300"
          Icon={NotebookPenIcon}
        />
        <ActionTile
          title={t.createQuote}
          description={t.createQuoteDescription}
          href="/quotes/new"
          accentClass="bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300"
          plusClass="bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"
          Icon={FileTextIcon}
        />
        <ActionTile
          title={t.createInvoice}
          description={t.createInvoiceDescription}
          onClick={() => router.push('/invoices')}
          accentClass="bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
          plusClass="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
          Icon={ReceiptTextIcon}
        />
      </div>

      {isAddNoteOpen ? <AddNoteModal onClose={() => setIsAddNoteOpen(false)} onSuccess={onActionSuccess} /> : null}
    </section>
  );
}