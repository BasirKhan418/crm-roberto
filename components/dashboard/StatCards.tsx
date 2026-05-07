'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AlertTriangleIcon, CalendarClockIcon, FileText, ReceiptTextIcon, TrendingUp } from 'lucide-react';

import ErrorMessage from '@/components/ui/ErrorMessage';
import { PriceDisplay } from '@/components/ui/PriceDisplay';
import { Skeleton } from '@/components/ui/skeleton';
import { useLocale } from '@/components/providers/locale-provider';

interface DashboardStats {
  totalClients?: number;
  totalSuppliers?: number;
  notesThisWeek?: number;
  quotesThisMonth?: number;
  acceptedQuotesValue?: number;
  overdueFollowUps?: number;
  overdueInvoices?: number;
  acceptedNotInvoiced?: number;
  unpaidInvoices?: number;
  nextActionDate?: string | null;
}

function isAbortError(reason: unknown): boolean {
  return reason instanceof DOMException && reason.name === 'AbortError';
}

function toWholeNumber(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.trunc(parsed);
}

export default function StatCards() {
  const { locale } = useLocale();
  const t = {
    en: {
      loadError: 'Could not load stats.',
      acceptedValue: 'Accepted Revenue',
      overdueFollowUps: 'Overdue Follow-ups',
      overdueInvoices: 'Overdue Invoices',
      acceptedNotInvoiced: 'Accepted Not Invoiced',
      unpaidInvoices: 'Open Invoices',
      nextActionDate: 'Next action date',
      aria: 'Dashboard key metrics',
      subRevenue: 'Validated deal value',
      subOverdueFollowUps: 'Needs immediate follow-up',
      subOverdueInvoices: 'Payment risk right now',
      subAcceptedNotInvoiced: 'Ready to convert to invoice',
      subUnpaidInvoices: 'Awaiting full payment',
      subNextActionDate: 'Most urgent upcoming date',
      noDate: 'No action date',
      riskLevel: 'Risk level',
      subRiskLevel: 'Combined overdue follow-ups and invoices',
    },
    fr: {
      loadError: 'Impossible de charger les statistiques.',
      acceptedValue: 'Chiffre Accepté',
      overdueFollowUps: 'Suivis en retard',
      overdueInvoices: 'Factures en retard',
      acceptedNotInvoiced: 'Acceptés non facturés',
      unpaidInvoices: 'Factures ouvertes',
      nextActionDate: 'Prochaine date d\'action',
      aria: 'Indicateurs clés',
      subRevenue: 'Valeur des affaires validées',
      subOverdueFollowUps: 'Relance immediate nécessaire',
      subOverdueInvoices: 'Risque encaissement actuel',
      subAcceptedNotInvoiced: 'A convertir en facture',
      subUnpaidInvoices: 'En attente de paiement complet',
      subNextActionDate: 'Date prioritaire a venir',
      noDate: 'Aucune date d\'action',
      riskLevel: 'Niveau de risque',
      subRiskLevel: 'Combinaison suivis + factures en retard',
    },
  }[locale];

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function loadStats() {
      setLoading(true);
      try {
        setFetchError(null);
        const response = await fetch('/api/dashboard/stats', {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!response.ok) throw new Error('Failed to load stats');
        const data = (await response.json()) as DashboardStats;
        setStats(data);
      } catch (caughtError) {
        if (isAbortError(caughtError) || controller.signal.aborted) return;
        setFetchError(t.loadError);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    loadStats();
    return () => controller.abort();
  }, [t.loadError]);

  const hasStats = stats !== null;
  const showError = Boolean(fetchError) && !hasStats;
  const priceLocale = locale === 'fr' ? 'fr-FR' : 'en-IE';
  const dateLocale = locale === 'fr' ? 'fr-FR' : 'en-GB';

  const nextActionLabel = stats?.nextActionDate
    ? new Date(stats.nextActionDate).toLocaleDateString(dateLocale, { day: '2-digit', month: 'short', year: 'numeric' })
    : t.noDate;

  const riskCount = toWholeNumber(stats?.overdueFollowUps) + toWholeNumber(stats?.overdueInvoices);

  const CARDS = [
    {
      label: t.acceptedValue,
      value: toWholeNumber(stats?.acceptedQuotesValue),
      type: 'currency' as const,
      subLabel: t.subRevenue,
      Icon: TrendingUp,
      border: 'border border-emerald-200/70 dark:border-emerald-900/50',
      iconBg: 'bg-emerald-50 dark:bg-emerald-950/35',
      iconColor: 'text-emerald-600 dark:text-emerald-300',
      numColor: 'text-emerald-700 dark:text-emerald-300',
      href: '/quotes?status=accepted',
    },
    {
      label: t.overdueFollowUps,
      value: toWholeNumber(stats?.overdueFollowUps),
      type: 'count' as const,
      subLabel: t.subOverdueFollowUps,
      Icon: CalendarClockIcon,
      border: 'border border-red-200/70 dark:border-red-900/50',
      iconBg: 'bg-red-50 dark:bg-red-950/35',
      iconColor: 'text-red-600 dark:text-red-300',
      numColor: 'text-red-700 dark:text-red-300',
      href: '/notes',
    },
    {
      label: t.overdueInvoices,
      value: toWholeNumber(stats?.overdueInvoices),
      type: 'count' as const,
      subLabel: t.subOverdueInvoices,
      Icon: AlertTriangleIcon,
      border: 'border border-rose-200/70 dark:border-rose-900/50',
      iconBg: 'bg-rose-50 dark:bg-rose-950/35',
      iconColor: 'text-rose-600 dark:text-rose-300',
      numColor: 'text-rose-700 dark:text-rose-300',
      href: '/invoices?status=overdue',
    },
    {
      label: t.acceptedNotInvoiced,
      value: toWholeNumber(stats?.acceptedNotInvoiced),
      type: 'count' as const,
      subLabel: t.subAcceptedNotInvoiced,
      Icon: FileText,
      border: 'border border-amber-200/70 dark:border-amber-900/50',
      iconBg: 'bg-amber-50 dark:bg-amber-950/35',
      iconColor: 'text-amber-600 dark:text-amber-300',
      numColor: 'text-amber-700 dark:text-amber-300',
      href: '/quotes?status=accepted',
    },
    {
      label: t.unpaidInvoices,
      value: toWholeNumber(stats?.unpaidInvoices),
      type: 'count' as const,
      subLabel: t.subUnpaidInvoices,
      Icon: ReceiptTextIcon,
      border: 'border border-sky-200/70 dark:border-sky-900/50',
      iconBg: 'bg-sky-50 dark:bg-sky-950/35',
      iconColor: 'text-sky-600 dark:text-sky-300',
      numColor: 'text-sky-700 dark:text-sky-300',
      href: '/invoices',
    },
    {
      label: t.nextActionDate,
      value: nextActionLabel,
      type: 'text' as const,
      subLabel: t.subNextActionDate,
      Icon: TrendingUp,
      border: 'border border-violet-200/70 dark:border-violet-900/50',
      iconBg: 'bg-violet-50 dark:bg-violet-950/35',
      iconColor: 'text-violet-600 dark:text-violet-300',
      numColor: 'text-violet-700 dark:text-violet-300',
      href: '/notes',
    },
    {
      label: t.riskLevel,
      value: riskCount,
      type: 'count' as const,
      subLabel: t.subRiskLevel,
      Icon: AlertTriangleIcon,
      border: 'border border-amber-200/70 dark:border-amber-900/50',
      iconBg: 'bg-amber-50 dark:bg-amber-950/35',
      iconColor: 'text-amber-600 dark:text-amber-300',
      numColor: 'text-amber-700 dark:text-amber-300',
      href: '/dashboard',
    },
  ] as const;

  return (
    <section className="mb-2 grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3" aria-label={t.aria}>
      {showError ? (
        <div className="sm:col-span-2 xl:col-span-3">
          <ErrorMessage message={fetchError ?? undefined} />
        </div>
      ) : null}

      {CARDS.map((card) => (
        <Link
          key={card.label}
          href={card.href}
          className={`rounded-2xl bg-card px-4 py-3.5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md sm:px-5 sm:py-4 ${card.border}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                {card.label}
              </p>
              <div className="mt-2">
                {loading ? (
                  <Skeleton className="h-9 w-20" />
                ) : card.type === 'currency' ? (
                  <PriceDisplay
                    cents={card.value}
                    locale={priceLocale}
                    className={`text-3xl font-bold tabular-nums ${card.numColor}`}
                  />
                ) : card.type === 'text' ? (
                  <p className={`text-xl font-bold ${card.numColor}`}>{card.value}</p>
                ) : (
                  <p className={`text-2xl font-bold tabular-nums sm:text-3xl ${card.numColor}`}>{card.value}</p>
                )}
              </div>
              <p className="mt-1.5 text-[11px] text-muted-foreground">{card.subLabel}</p>
            </div>
            <div className={`shrink-0 rounded-lg p-2.5 ${card.iconBg}`}>
              <card.Icon className={`size-5 ${card.iconColor}`} strokeWidth={1.75} />
            </div>
          </div>
        </Link>
      ))}
    </section>
  );
}