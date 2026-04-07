'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { AlertTriangleIcon, ArrowRightIcon, CalendarCheckIcon, CalendarClockIcon, Clock3Icon, FileTextIcon, MailWarningIcon, ReceiptTextIcon, UserX2Icon } from 'lucide-react';
import { toast } from 'sonner';

import SendQuoteModal from '@/components/quotes/SendQuoteModal';
import { useLocale } from '@/components/providers/locale-provider';
import BaseAddModal from '@/components/modals/BaseAddModal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import EmptyState from '@/components/ui/EmptyState';
import ErrorMessage from '@/components/ui/ErrorMessage';
import { Skeleton } from '@/components/ui/skeleton';
import type { FollowUpItem } from '@/hooks/useDashboard';

const DAY_IN_MS = 86_400_000;

type PriorityTone = 'overdue' | 'today' | 'tomorrow' | 'upcoming';
type SmartActionTone = 'urgent' | 'medium' | 'neutral';

interface FollowUpQuoteItem {
  _id: string;
  quoteNumber: string;
  clientSnapshot: {
    fullName: string;
    email?: string | null;
  };
}

interface SmartActionsData {
  pendingQuoteFollowUps: {
    count: number;
    target: FollowUpQuoteItem | null;
  };
  acceptedNotInvoiced: {
    count: number;
    target: {
      _id: string;
      quoteNumber: string;
      clientId: string;
    } | null;
  };
  inactiveClients: {
    count: number;
    target: {
      _id: string;
      fullName: string;
      email?: string | null;
    } | null;
  };
  overdueInvoices: {
    count: number;
    target: {
      _id: string;
      invoiceNumber: string;
      clientSnapshot: {
        fullName: string;
        email?: string | null;
      };
    } | null;
  };
}

interface SmartActionsResponse {
  success?: boolean;
  message?: string;
  data?: SmartActionsData;
}

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

function getSmartToneClasses(tone: SmartActionTone): { row: string; icon: string; badge: string } {
  if (tone === 'urgent') {
    return {
      row: 'border-red-200/80 bg-red-50/70 dark:border-red-900/50 dark:bg-red-950/20',
      icon: 'bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-200',
      badge: 'bg-red-600 text-white',
    };
  }

  if (tone === 'medium') {
    return {
      row: 'border-amber-200/80 bg-amber-50/70 dark:border-amber-900/50 dark:bg-amber-950/20',
      icon: 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-200',
      badge: 'bg-amber-500 text-amber-950',
    };
  }

  return {
    row: 'border-sky-200/80 bg-sky-50/70 dark:border-sky-900/50 dark:bg-sky-950/20',
    icon: 'bg-sky-100 text-sky-700 dark:bg-sky-900/60 dark:text-sky-200',
    badge: 'bg-sky-600 text-white',
  };
}

function SmartActionRow({
  title,
  description,
  buttonLabel,
  tone,
  Icon,
  onClick,
  disabled,
}: {
  title: string;
  description: string;
  buttonLabel: string;
  tone: SmartActionTone;
  Icon: React.ElementType;
  onClick: () => void;
  disabled?: boolean;
}) {
  const toneClass = getSmartToneClasses(tone);

  return (
    <div className={`rounded-2xl border p-3 transition-colors ${toneClass.row}`}>
      <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
        <div className="flex min-w-0 items-start justify-center gap-3 sm:justify-start">
          <div className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl ${toneClass.icon}`}>
            <Icon className="size-4.5" strokeWidth={1.9} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground sm:truncate">{title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          </div>
        </div>

        <div className="flex w-full shrink-0 items-center justify-center sm:w-auto sm:justify-end sm:pl-3">
          <Button
            type="button"
            size="sm"
            onClick={onClick}
            disabled={disabled}
            className={`h-8 w-full rounded-full px-3 text-xs font-semibold sm:w-auto ${toneClass.badge}`}
          >
            {buttonLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function PriorityActionsPanel({
  followUps = [],
  loading = false,
  error = null,
  onActionSuccess,
}: PriorityActionsPanelProps) {
  const router = useRouter();
  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false);
  const [isInvoiceConfirmOpen, setIsInvoiceConfirmOpen] = useState(false);
  const [isReminderConfirmOpen, setIsReminderConfirmOpen] = useState(false);
  const [smartActionsData, setSmartActionsData] = useState<SmartActionsData | null>(null);
  const [smartActionsLoading, setSmartActionsLoading] = useState(true);
  const [actionLoadingKey, setActionLoadingKey] = useState<string | null>(null);
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
      smartActionsTitle: 'Smart Actions',
      quotesNeedFollowUp: (count: number) => `${count} quotes need follow-up`,
      noQuotesNeedFollowUp: 'No sent quotes need follow-up',
      followUpDescription: 'Sent quotes older than 7 days and still waiting for client response.',
      followUpAction: 'Follow up',
      reviewQuotesAction: 'Review quotes',
      acceptedNotInvoiced: (count: number) => `${count} accepted quotes not invoiced`,
      noAcceptedNotInvoiced: 'No accepted quotes waiting for invoicing',
      acceptedNotInvoicedDescription: 'Turn accepted work into invoices and keep cash flow moving.',
      createInvoiceActionButton: 'Create invoice',
      reviewAcceptedQuotesAction: 'Review quotes',
      confirmInvoiceTitle: 'Create invoice from accepted quote?',
      confirmInvoiceDescription: (quoteNumber: string) =>
        `This will create a new invoice draft for quote ${quoteNumber} immediately. Continue only if you are ready to bill this accepted work.`,
      confirmInvoiceCancel: 'Cancel',
      confirmInvoiceAction: 'Create invoice',
      confirmInvoicePending: 'Creating...',
      confirmReminderTitle: 'Send payment reminder?',
      confirmReminderDescription: (invoiceNumber: string) =>
        `A reminder email will be sent to the client for invoice ${invoiceNumber}. This action cannot be undone.`,
      confirmReminderCancel: 'Cancel',
      confirmReminderAction: 'Send reminder',
      confirmReminderPending: 'Sending...',
      inactiveClients: (count: number) => `${count} inactive clients`,
      noInactiveClients: 'No inactive clients right now',
      inactiveClientsDescription: 'No quote, invoice, or note activity in the last 30 days.',
      contactClientActionButton: 'Contact client',
      reviewClientsAction: 'Review clients',
      overdueInvoices: (count: number) => `${count} overdue invoices`,
      noOverdueInvoices: 'No overdue invoices to remind',
      overdueInvoicesDescription: 'Past due date and still not fully paid.',
      sendReminderActionButton: 'Send reminder',
      reviewInvoicesAction: 'Review invoices',
      invoiceCreated: 'Invoice created from accepted quote',
      invoiceReminderSent: 'Invoice reminder sent',
      smartActionFailed: 'Smart action failed',
      followUpSubject: (quoteNumber: string) => `Follow-up on quote ${quoteNumber}`,
      followUpMessage: (quoteNumber: string, clientName?: string | null) => {
        const greeting = clientName ? `Hi ${clientName},` : 'Hi,';
        return `${greeting}\n\nI am following up on quote ${quoteNumber} shared last week. Please let us know if you have any questions or if you would like us to adjust anything before signing.\n\nBest regards,`;
      },
      overdue: (count: number) => `${count}d overdue`,
      dueToday: 'Due today',
      tomorrow: 'Tomorrow',
      inDays: (count: number) => `In ${count}d`,
    },
    fr: {
      kicker: 'Actions prioritaires',
      title: "Traitez l'urgent en premier",
      subtitle: 'Les notes en retard et les prochains suivis apparaissent avant le reste du tableau de bord.',
      unknown: '\u00c9l\u00e9ment inconnu',
      noPriority: 'Aucun suivi urgent pour le moment. Utilisez une action rapide pour faire avancer le pipeline.',
      addNote: 'Ajouter une note',
      addNoteDescription: "Capturez un suivi ou une t\u00e2che interne avant qu'il ne disparaisse.",
      createQuote: 'Cr\u00e9er un devis',
      createQuoteDescription: 'D\u00e9marrez un nouveau devis directement depuis le tableau de bord.',
      createInvoice: 'Cr\u00e9er une facture',
      createInvoiceDescription: "Ouvrez l'espace factures pour pr\u00e9parer la facturation.",
      overdueBadge: (count: number) => `${count} en retard`,
      dueTodayBadge: (count: number) => `${count} aujourd'hui`,
      smartActionsTitle: 'Actions intelligentes',
      quotesNeedFollowUp: (count: number) => `${count} devis \u00e0 relancer`,
      noQuotesNeedFollowUp: 'Aucun devis envoy\u00e9 \u00e0 relancer',
      followUpDescription: 'Devis envoy\u00e9s depuis plus de 7 jours sans r\u00e9ponse client.',
      followUpAction: 'Relancer',
      reviewQuotesAction: 'Voir devis',
      acceptedNotInvoiced: (count: number) => `${count} devis accept\u00e9s non factur\u00e9s`,
      noAcceptedNotInvoiced: 'Aucun devis accept\u00e9 en attente de facturation',
      acceptedNotInvoicedDescription: "Transformez les devis accept\u00e9s en factures pour acc\u00e9l\u00e9rer l'encaissement.",
      createInvoiceActionButton: 'Cr\u00e9er facture',
      reviewAcceptedQuotesAction: 'Voir devis',
      confirmInvoiceTitle: 'Cr\u00e9er une facture depuis ce devis accept\u00e9 ?',
      confirmInvoiceDescription: (quoteNumber: string) =>
        `Cette action va cr\u00e9er imm\u00e9diatement un brouillon de facture pour le devis ${quoteNumber}. Continuez seulement si vous \u00eates pr\u00eat \u00e0 facturer ce travail accept\u00e9.`,
      confirmInvoiceCancel: 'Annuler',
      confirmInvoiceAction: 'Cr\u00e9er facture',
      confirmInvoicePending: 'Cr\u00e9ation...',
      confirmReminderTitle: 'Envoyer le rappel de paiement\u00a0?',
      confirmReminderDescription: (invoiceNumber: string) =>
        `Un e-mail de rappel sera envoy\u00e9 au client pour la facture ${invoiceNumber}. Cette action est irr\u00e9versible.`,
      confirmReminderCancel: 'Annuler',
      confirmReminderAction: 'Envoyer rappel',
      confirmReminderPending: 'Envoi...',
      inactiveClients: (count: number) => `${count} clients inactifs`,
      noInactiveClients: 'Aucun client inactif actuellement',
      inactiveClientsDescription: 'Aucune activit\u00e9 devis, facture, ou note sur les 30 derniers jours.',
      contactClientActionButton: 'Contacter client',
      reviewClientsAction: 'Voir clients',
      overdueInvoices: (count: number) => `${count} factures en retard`,
      noOverdueInvoices: 'Aucune facture en retard',
      overdueInvoicesDescription: "Date d'\u00e9ch\u00e9ance d\u00e9pass\u00e9e et facture non r\u00e9gl\u00e9e.",
      sendReminderActionButton: 'Envoyer rappel',
      reviewInvoicesAction: 'Voir factures',
      invoiceCreated: 'Facture cr\u00e9\u00e9e depuis le devis accept\u00e9',
      invoiceReminderSent: 'Rappel de facture envoy\u00e9',
      smartActionFailed: "Impossible d'ex\u00e9cuter l'action",
      followUpSubject: (quoteNumber: string) => `Relance devis ${quoteNumber}`,
      followUpMessage: (quoteNumber: string, clientName?: string | null) => {
        const greeting = clientName ? `Bonjour ${clientName},` : 'Bonjour,';
        return `${greeting}\n\nJe me permets de revenir vers vous concernant le devis ${quoteNumber} envoy\u00e9 la semaine derni\u00e8re. Dites-nous si vous avez des questions ou si vous souhaitez un ajustement avant signature.\n\nBien cordialement,`;
      },
      overdue: (count: number) => `${count} j de retard`,
      dueToday: "Pour aujourd'hui",
      tomorrow: 'Demain',
      inDays: (count: number) => `Dans ${count} j`,
    },
  }[locale];

  useEffect(() => {
    const controller = new AbortController();

    async function loadSmartActions() {
      setSmartActionsLoading(true);

      try {
        const response = await fetch('/api/dashboard/smart-actions', {
          cache: 'no-store',
          signal: controller.signal,
        });

        const payload = (await response.json()) as SmartActionsResponse;
        if (!response.ok || !payload.success) {
          throw new Error(payload.message || t.smartActionFailed);
        }

        setSmartActionsData(payload.data ?? null);
      } catch {
        if (!controller.signal.aborted) {
          setSmartActionsData(null);
        }
      } finally {
        if (!controller.signal.aborted) {
          setSmartActionsLoading(false);
        }
      }
    }

    loadSmartActions();

    return () => controller.abort();
  }, [onActionSuccess, t.smartActionFailed]);

  async function runSmartAction(
    actionKey: string,
    payload: Record<string, unknown>,
    successMessage: string,
    fallbackError: string
  ) {
    setActionLoadingKey(actionKey);
    try {
      const response = await fetch('/api/dashboard/smart-actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const body = (await response.json()) as { success?: boolean; message?: string };
      if (!response.ok || !body.success) {
        throw new Error(body.message || fallbackError);
      }

      toast.success(successMessage);
      onActionSuccess?.();

      const refresh = await fetch('/api/dashboard/smart-actions', { cache: 'no-store' });
      const refreshPayload = (await refresh.json()) as SmartActionsResponse;
      if (refresh.ok && refreshPayload.success) {
        setSmartActionsData(refreshPayload.data ?? null);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : fallbackError);
    } finally {
      setActionLoadingKey(null);
    }
  }

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
  const followUpTarget = smartActionsData?.pendingQuoteFollowUps.target ?? null;
  const followUpCount = smartActionsData?.pendingQuoteFollowUps.count ?? 0;
  const acceptedTarget = smartActionsData?.acceptedNotInvoiced.target ?? null;
  const acceptedCount = smartActionsData?.acceptedNotInvoiced.count ?? 0;
  const inactiveClientTarget = smartActionsData?.inactiveClients.target ?? null;
  const inactiveCount = smartActionsData?.inactiveClients.count ?? 0;
  const overdueInvoiceTarget = smartActionsData?.overdueInvoices.target ?? null;
  const overdueInvoiceCount = smartActionsData?.overdueInvoices.count ?? 0;
  const isAcceptedInvoiceLoading = actionLoadingKey === 'accepted-to-invoice';

  function handleAcceptedInvoiceConfirm() {
    if (!acceptedTarget || isAcceptedInvoiceLoading) {
      return;
    }

    void runSmartAction(
      'accepted-to-invoice',
      { action: 'create-invoice-from-quote', quoteId: acceptedTarget._id },
      t.invoiceCreated,
      t.smartActionFailed
    );
  }

  function handleReminderConfirm() {
    if (!overdueInvoiceTarget || actionLoadingKey === 'overdue-invoices') {
      return;
    }

    void runSmartAction(
      'overdue-invoices',
      { action: 'send-invoice-reminder', invoiceId: overdueInvoiceTarget._id, locale },
      t.invoiceReminderSent,
      t.smartActionFailed
    );
  }

  const smartActions = [
    {
      key: 'follow-up-quotes',
      tone: followUpCount > 0 ? ('urgent' as const) : ('neutral' as const),
      title: followUpCount > 0 ? t.quotesNeedFollowUp(followUpCount) : t.noQuotesNeedFollowUp,
      description: t.followUpDescription,
      buttonLabel: followUpCount > 0 ? t.followUpAction : t.reviewQuotesAction,
      Icon: MailWarningIcon,
      onClick: () => {
        if (followUpTarget?.clientSnapshot?.email) {
          setIsFollowUpModalOpen(true);
          return;
        }
        router.push('/quotes');
      },
      disabled: smartActionsLoading,
    },
    {
      key: 'accepted-to-invoice',
      tone: 'medium' as const,
      title: acceptedCount > 0 ? t.acceptedNotInvoiced(acceptedCount) : t.noAcceptedNotInvoiced,
      description: t.acceptedNotInvoicedDescription,
      buttonLabel: acceptedCount > 0 ? t.createInvoiceActionButton : t.reviewAcceptedQuotesAction,
      Icon: ReceiptTextIcon,
      onClick: () => {
        if (!acceptedTarget) {
          router.push('/quotes?status=accepted');
          return;
        }

        setIsInvoiceConfirmOpen(true);
      },
      disabled: smartActionsLoading || isAcceptedInvoiceLoading,
    },
    {
      key: 'inactive-clients',
      tone: 'neutral' as const,
      title: inactiveCount > 0 ? t.inactiveClients(inactiveCount) : t.noInactiveClients,
      description: t.inactiveClientsDescription,
      buttonLabel: inactiveCount > 0 ? t.contactClientActionButton : t.reviewClientsAction,
      Icon: UserX2Icon,
      onClick: () => {
        if (!inactiveClientTarget) {
          router.push('/clients');
          return;
        }
        router.push(`/clients/${inactiveClientTarget._id}`);
      },
      disabled: smartActionsLoading,
    },
    {
      key: 'overdue-invoices',
      tone: overdueInvoiceCount > 0 ? ('urgent' as const) : ('neutral' as const),
      title: overdueInvoiceCount > 0 ? t.overdueInvoices(overdueInvoiceCount) : t.noOverdueInvoices,
      description: t.overdueInvoicesDescription,
      buttonLabel: overdueInvoiceCount > 0 ? t.sendReminderActionButton : t.reviewInvoicesAction,
      Icon: FileTextIcon,
      onClick: () => {
        if (!overdueInvoiceTarget) {
          router.push('/invoices');
          return;
        }

        setIsReminderConfirmOpen(true);
      },
      disabled: smartActionsLoading || actionLoadingKey === 'overdue-invoices',
    },
  ] as const;

  return (
    <>
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

      <Card className="gap-0 overflow-hidden border border-foreground/10">
        <CardHeader className="border-b bg-slate-50 px-5 py-4 dark:bg-slate-900/40">
          <CardTitle className="text-lg font-semibold text-foreground">{t.smartActionsTitle}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-4">
          {smartActions.map((action) => (
            <SmartActionRow
              key={action.key}
              title={action.title}
              description={action.description}
              buttonLabel={action.buttonLabel}
              tone={action.tone}
              Icon={action.Icon}
              onClick={action.onClick}
              disabled={action.disabled}
            />
          ))}
        </CardContent>
      </Card>

    </section>

    {isInvoiceConfirmOpen ? (
      <BaseAddModal
        title={t.confirmInvoiceTitle}
        description={acceptedTarget ? t.confirmInvoiceDescription(acceptedTarget.quoteNumber) : t.acceptedNotInvoicedDescription}
        onClose={() => setIsInvoiceConfirmOpen(false)}
      >
        <div className="flex gap-2 pt-1">
          <Button type="button" variant="outline" className="flex-1" disabled={isAcceptedInvoiceLoading} onClick={() => setIsInvoiceConfirmOpen(false)}>
            {t.confirmInvoiceCancel}
          </Button>
          <Button type="button" className="flex-1" disabled={isAcceptedInvoiceLoading} onClick={() => { handleAcceptedInvoiceConfirm(); setIsInvoiceConfirmOpen(false); }}>
            {isAcceptedInvoiceLoading ? t.confirmInvoicePending : t.confirmInvoiceAction}
          </Button>
        </div>
      </BaseAddModal>
    ) : null}

    {isReminderConfirmOpen ? (
      <BaseAddModal
        title={t.confirmReminderTitle}
        description={overdueInvoiceTarget ? t.confirmReminderDescription(overdueInvoiceTarget.invoiceNumber) : t.overdueInvoicesDescription}
        onClose={() => setIsReminderConfirmOpen(false)}
      >
        <div className="flex gap-2 pt-1">
          <Button type="button" variant="outline" className="flex-1" disabled={actionLoadingKey === 'overdue-invoices'} onClick={() => setIsReminderConfirmOpen(false)}>
            {t.confirmReminderCancel}
          </Button>
          <Button type="button" className="flex-1" disabled={actionLoadingKey === 'overdue-invoices'} onClick={() => { handleReminderConfirm(); setIsReminderConfirmOpen(false); }}>
            {actionLoadingKey === 'overdue-invoices' ? t.confirmReminderPending : t.confirmReminderAction}
          </Button>
        </div>
      </BaseAddModal>
    ) : null}

    {isFollowUpModalOpen && followUpTarget ? (
      <SendQuoteModal
        open={isFollowUpModalOpen}
        onOpenChange={setIsFollowUpModalOpen}
        quoteId={followUpTarget._id}
        quoteNumber={followUpTarget.quoteNumber}
        clientEmail={followUpTarget.clientSnapshot.email}
        clientName={followUpTarget.clientSnapshot.fullName}
        companyName={null}
        quoteStatus="sent"
        locale={locale}
        initialSubject={t.followUpSubject(followUpTarget.quoteNumber)}
        initialMessage={t.followUpMessage(followUpTarget.quoteNumber, followUpTarget.clientSnapshot.fullName)}
        onSent={onActionSuccess}
      />
    ) : null}
    </>
  );
}