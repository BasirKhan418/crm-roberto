'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import Link from 'next/link';
import { useSWRConfig } from 'swr';
import useSWR from 'swr';
import useSWRInfinite from 'swr/infinite';
import { DownloadIcon, ForwardIcon, GavelIcon, Loader2Icon, MailIcon, PowerIcon, SendIcon } from 'lucide-react';
import { toast } from 'sonner';

import SendReminderModal from '@/components/invoices/SendReminderModal';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatInvoiceDisplayNumber, resolveTranslatedError, translate } from '@/lib/i18n/messages';
import { cn } from '@/lib/utils';

type Locale = 'en' | 'fr';
type ReminderLevel = 0 | 1 | 2 | 3 | 4;
type ReminderLogStatus = 'sent' | 'failed' | 'skipped' | 'paused' | 'resumed';

type LegalRecoveryIneligibleReason =
  | 'invoice_paid'
  | 'formal_notice_not_sent'
  | 'formal_notice_deadline_not_reached'
  | 'amount_exceeds_threshold'
  | 'amount_is_zero';

type LegalRecoveryWarningReason = 'formal_notice_deadline_not_reached';
type LegalRecoveryArtifactKind = 'payment-order' | 'recovery-file';

interface LegalRecoveryEligibilityData {
  eligible: boolean;
  reason: LegalRecoveryIneligibleReason | null;
  warningReason?: LegalRecoveryWarningReason | null;
  claimAmountCents: number;
  claimThresholdCents: number;
  formalNoticeSentAt?: string | Date | null;
  formalNoticeDeadline?: string | Date | null;
  legalRecoveryInitiatedAt?: string | Date | null;
  jurisdiction?: string | null;
  courtLocation?: string | null;
  courtConfigured?: boolean;
}

interface ReminderState {
  level?: number | null;
  lastSentAt?: string | Date | null;
  nextScheduledAt?: string | Date | null;
  isPaused?: boolean;
  formalNoticeSentAt?: string | Date | null;
  formalNoticeDeadline?: string | Date | null;
  legalRecoveryInitiatedAt?: string | Date | null;
}

interface ReminderLogItem {
  _id: string;
  level: 1 | 2 | 3 | 4;
  channel: 'email' | 'whatsapp';
  status: ReminderLogStatus;
  subject?: string;
  sentAt?: string;
}

interface ReminderLogsResponse {
  success: boolean;
  data?: ReminderLogItem[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  message?: string;
}

interface CollectionTabProps {
  invoiceId: string;
  locale: Locale;
  invoiceStatus?: 'unpaid' | 'partial_paid' | 'paid' | 'overdue' | null;
  clientName?: string | null;
  invoiceNumber?: string | null;
  dueDate?: string | Date | null;
  invoiceDate?: string | Date | null;
  amountDue?: number | null;
  companyName?: string | null;
  reminderState?: ReminderState | null;
  onInvoiceRefresh: () => Promise<void> | void;
  layout?: 'full' | 'compact' | 'history';
}

const PAGE_SIZE = 10;

function computeRelativeDate(value: string | Date | null | undefined, locale: Locale): string {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return '-';
  }

  const diffMs = Date.now() - date.getTime();
  const days = Math.floor(diffMs / 86400000);
  if (days <= 0) {
    return locale === 'fr' ? 'Aujourd\'hui' : 'Today';
  }

  if (days === 1) {
    return locale === 'fr' ? 'Il y a 1 jour' : '1 day ago';
  }

  return locale === 'fr' ? `Il y a ${days} jours` : `${days} days ago`;
}

const fetcher = async (url: string): Promise<ReminderLogsResponse> => {
  const response = await fetch(url, { cache: 'no-store' });
  const payload = (await response.json()) as ReminderLogsResponse;

  if (!response.ok || !payload.success) {
    throw new Error(payload.message || 'Failed to load reminder logs');
  }

  return payload;
};

interface LegalRecoveryEligibilityResponse {
  success: boolean;
  data?: LegalRecoveryEligibilityData;
  message?: string;
}

const legalRecoveryFetcher = async (url: string): Promise<LegalRecoveryEligibilityResponse> => {
  const response = await fetch(url, { cache: 'no-store' });
  const payload = (await response.json()) as LegalRecoveryEligibilityResponse;
  if (!response.ok || !payload.success) {
    throw new Error(payload.message || 'Failed to load legal recovery eligibility');
  }
  return payload;
};

function formatEur(cents: number, locale: Locale): string {
  const safe = Number.isFinite(cents) ? cents : 0;
  return new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', {
    style: 'currency',
    currency: 'EUR',
  })
    .format(safe / 100)
    .replace(/[\u00a0\u202f]/g, ' ');
}

export default function CollectionTab({
  invoiceId,
  locale,
  invoiceStatus,
  clientName,
  invoiceNumber,
  dueDate,
  invoiceDate,
  amountDue,
  companyName,
  reminderState,
  onInvoiceRefresh,
  layout = 'full',
}: CollectionTabProps) {
  const [showSendModal, setShowSendModal] = useState(false);
  const [showFormalNoticeConfirm, setShowFormalNoticeConfirm] = useState(false);
  const [showLegalRecoveryConfirm, setShowLegalRecoveryConfirm] = useState(false);
  const [pendingLegalRecoveryKind, setPendingLegalRecoveryKind] = useState<LegalRecoveryArtifactKind | null>(null);
  const [downloadingLegalRecoveryKind, setDownloadingLegalRecoveryKind] = useState<LegalRecoveryArtifactKind | null>(null);
  const [updatingState, setUpdatingState] = useState(false);
  const { mutate: globalMutate } = useSWRConfig();

  const t = useCallback(
    (key: string, replacements?: Record<string, string | number | null | undefined>) =>
      translate(locale, key, replacements),
    [locale]
  );

  const refreshLogsCache = useCallback(
    () =>
      globalMutate(
        (key) => typeof key === 'string' && key.startsWith(`/api/invoices/${invoiceId}/reminders/logs`),
        undefined,
        { revalidate: true }
      ),
    [globalMutate, invoiceId]
  );  const formatSentDate = useCallback(
    (value: string | Date | null | undefined): string => {
      if (!value) {
        return '';
      }

      const date = new Date(value);
      if (!Number.isFinite(date.getTime())) {
        return '';
      }

      return new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(date);
    },
    [locale]
  );

  const currentLevel = Math.max(0, Math.min(4, Math.round(reminderState?.level ?? 0))) as ReminderLevel;
  const isDisabled = reminderState?.isPaused === true;
  const isInvoicePaid = invoiceStatus === 'paid';
  const nextLevel = Math.max(1, Math.min(4, currentLevel + 1)) as 1 | 2 | 3 | 4;
  const showControls = layout !== 'history';
  const showHistory = layout !== 'compact';
  const isCompact = layout === 'compact';
  const formalNoticeAlreadySent = currentLevel >= 4 && Boolean(reminderState?.formalNoticeSentAt ?? reminderState?.lastSentAt);
  const sendReminderLabel = formalNoticeAlreadySent
    ? t('reminders.actions.resendFormalNotice')
    : currentLevel > 0
      ? t('reminders.actions.sendAgain')
      : t('reminders.actions.sendNow');
  const formalNoticeSentDateLabel = formatSentDate(reminderState?.formalNoticeSentAt ?? reminderState?.lastSentAt);

  const handleSendClick = useCallback(() => {
    if (formalNoticeAlreadySent) {
      setShowFormalNoticeConfirm(true);
      return;
    }
    setShowSendModal(true);
  }, [formalNoticeAlreadySent]);

  const statusLabel = isDisabled
    ? t('reminders.simpleStatus.inactive')
    : t('reminders.simpleStatus.active');

  const statusBadgeClass = isDisabled
    ? 'bg-slate-100 text-slate-700'
    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300';

  const lastSentLabel = useMemo(() => {
    if (!reminderState?.lastSentAt || currentLevel < 1) {
      return null;
    }

    const dateLabel = formatSentDate(reminderState.lastSentAt);
    if (!dateLabel) {
      return null;
    }

    if (currentLevel >= 4) {
      const formalNoticeDate = formatSentDate(reminderState?.formalNoticeSentAt ?? reminderState?.lastSentAt);
      return t('reminders.formalNoticeSent', { date: formalNoticeDate || dateLabel });
    }

    return t('reminders.reminderSent', { level: currentLevel, date: dateLabel });
  }, [currentLevel, formatSentDate, reminderState?.formalNoticeSentAt, reminderState?.lastSentAt, t]);

  const nextScheduledLabel = useMemo(() => {
    if (isDisabled) {
      return t('reminders.simpleStatus.disabledDescription');
    }

    if (currentLevel >= 4) {
      return t('reminders.collection.completed');
    }

    const nextDate = reminderState?.nextScheduledAt ? new Date(reminderState.nextScheduledAt) : null;
    if (!nextDate || !Number.isFinite(nextDate.getTime())) {
      return t('reminders.collection.notScheduled');
    }

    const diffDays = Math.max(0, Math.ceil((nextDate.getTime() - Date.now()) / 86400000));
    return t('reminders.nextScheduled', { days: diffDays });
  }, [currentLevel, isDisabled, reminderState?.nextScheduledAt, t]);

  const statusDetailsNode = (
    <div className="min-w-0 space-y-1">
      <div className="flex items-center gap-2">
        <Badge className={cn('border-0', statusBadgeClass)}>{statusLabel}</Badge>
      </div>
      {lastSentLabel ? (
        <p className="text-sm font-medium text-foreground">{lastSentLabel}</p>
      ) : (
        <p className="text-sm text-muted-foreground">{t('reminders.noReminderSent')}</p>
      )}
      <p className="text-xs text-muted-foreground">{nextScheduledLabel}</p>
    </div>
  );

  const getKey = (index: number, previousPageData: ReminderLogsResponse | null) => {
    if (!showHistory) {
      return null;
    }

    if (previousPageData && previousPageData.pagination && index + 1 > previousPageData.pagination.totalPages) {
      return null;
    }

    return `/api/invoices/${invoiceId}/reminders/logs?page=${index + 1}&limit=${PAGE_SIZE}`;
  };

  const {
    data,
    error,
    isLoading,
    size,
    setSize,
    mutate,
    isValidating,
  } = useSWRInfinite<ReminderLogsResponse>(getKey, fetcher, {
    revalidateFirstPage: false,
  });

  const logs = useMemo(() => data?.flatMap((page) => page.data ?? []) ?? [], [data]);
  const pagination = data?.[data.length - 1]?.pagination;
  const hasMore = pagination ? size < pagination.totalPages : false;

  const legalRecoveryShouldFetch = !isInvoicePaid;
  const canDownloadLegalNotice = !isInvoicePaid;
  const {
    data: legalRecoveryResp,
    mutate: mutateLegalRecovery,
  } = useSWR<LegalRecoveryEligibilityResponse>(
    legalRecoveryShouldFetch ? `/api/invoices/${invoiceId}/reminders/legal-recovery/eligibility` : null,
    legalRecoveryFetcher,
    { revalidateOnFocus: false }
  );
  const legalRecovery = legalRecoveryResp?.data ?? null;

  useEffect(() => {
    if (!showHistory) {
      return;
    }

    function handleRefresh(event: Event) {
      const detail = (event as CustomEvent<{ invoiceId?: string }>).detail;
      if (!detail?.invoiceId || detail.invoiceId !== invoiceId) {
        return;
      }
      void mutate();
    }

    window.addEventListener('reminder-logs:refresh', handleRefresh);
    return () => window.removeEventListener('reminder-logs:refresh', handleRefresh);
  }, [invoiceId, mutate, showHistory]);

  async function toggleDisabled() {
    setUpdatingState(true);

    try {
      const url = `/api/invoices/${invoiceId}/reminders/${isDisabled ? 'resume' : 'pause'}`;
      const response = await fetch(url, { method: 'POST' });
      const payload = (await response.json()) as { success?: boolean; message?: string };
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || t('reminders.collection.actionFailed'));
      }

      toast.success(isDisabled ? t('reminders.simpleStatus.enableSuccess') : t('reminders.simpleStatus.disableSuccess'));
      await Promise.resolve(onInvoiceRefresh());
      await mutate();
      await refreshLogsCache();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('reminder-logs:refresh', { detail: { invoiceId } }));
      }
    } catch (actionError) {
      toast.error(resolveTranslatedError(locale, actionError, t('reminders.collection.actionFailed')));
    } finally {
      setUpdatingState(false);
    }
  }

  async function skipNextReminder() {
    if (currentLevel >= 3 || isDisabled) {
      return;
    }

    setUpdatingState(true);

    try {
      const response = await fetch(`/api/invoices/${invoiceId}/reminders/skip`, { method: 'POST' });
      const payload = (await response.json()) as { success?: boolean; message?: string };
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || t('reminders.collection.actionFailed'));
      }

      toast.success(t('reminders.collection.skipSuccess'));
      await Promise.resolve(onInvoiceRefresh());
      await mutate();
      await refreshLogsCache();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('reminder-logs:refresh', { detail: { invoiceId } }));
      }
    } catch (actionError) {
      toast.error(resolveTranslatedError(locale, actionError, t('reminders.collection.actionFailed')));
    } finally {
      setUpdatingState(false);
    }
  }

  async function downloadLegalNotice() {
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/reminders/legal-notice/pdf?locale=${locale}`);
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error((payload as { message?: string } | null)?.message || 'Failed to download legal notice');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const legalNoticeFilenamePrefix = locale === 'fr' ? 'mise-en-demeure' : 'formal-notice';
      link.href = url;
      link.download = `${legalNoticeFilenamePrefix}-${invoiceNumber ? formatInvoiceDisplayNumber(locale, invoiceNumber) : invoiceId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      toast.error(resolveTranslatedError(locale, downloadError, t('reminders.collection.actionFailed')));
    }
  }

  async function downloadLegalRecoveryArtifact(kind: LegalRecoveryArtifactKind, allowBeforeDeadline = false) {
    const hasDeadlineWarning = legalRecovery?.warningReason === 'formal_notice_deadline_not_reached';
    if (hasDeadlineWarning && !allowBeforeDeadline) {
      setPendingLegalRecoveryKind(kind);
      setShowLegalRecoveryConfirm(true);
      return;
    }

    setDownloadingLegalRecoveryKind(kind);

    try {
      const endpointBase = kind === 'payment-order'
        ? `/api/invoices/${invoiceId}/reminders/legal-recovery/payment-order/pdf`
        : `/api/invoices/${invoiceId}/reminders/legal-recovery/recovery-file`;
      const endpoint = `${endpointBase}?locale=${locale}${hasDeadlineWarning && allowBeforeDeadline ? '&allowBeforeDeadline=1' : ''}`;
      const response = await fetch(endpoint);
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { message?: string; reason?: LegalRecoveryWarningReason | null } | null;
        if (response.status === 409 && payload?.reason === 'formal_notice_deadline_not_reached') {
          setPendingLegalRecoveryKind(kind);
          setShowLegalRecoveryConfirm(true);
          return;
        }
        throw new Error(
          payload?.message || t('reminders.legalRecovery.downloadFailed')
        );
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const displayNumber = invoiceNumber ? formatInvoiceDisplayNumber(locale, invoiceNumber) : invoiceId;
      const isFr = locale === 'fr';
      const filename = kind === 'payment-order'
        ? `${isFr ? 'requete-en-paiement' : 'payment-order-request'}-${displayNumber}.pdf`
        : `${isFr ? 'dossier-recouvrement' : 'recovery-file'}-${displayNumber}.zip`;
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(
        kind === 'payment-order'
          ? t('reminders.legalRecovery.downloadPaymentOrderSuccess')
          : t('reminders.legalRecovery.downloadRecoveryFileSuccess')
      );

      await Promise.resolve(onInvoiceRefresh());
      await mutateLegalRecovery();
    } catch (downloadError) {
      toast.error(resolveTranslatedError(locale, downloadError, t('reminders.legalRecovery.downloadFailed')));
    } finally {
      setDownloadingLegalRecoveryKind(null);
    }
  }

  const controlsNode = isCompact ? (
    <div className="rounded-lg border border-border/70 bg-card p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        {statusDetailsNode}
        <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
          <Button
            type="button"
            size="sm"
            className="h-8 w-full sm:w-auto"
            disabled={isDisabled || isInvoicePaid}
            onClick={handleSendClick}
          >
            <SendIcon className="size-3.5" />
            {sendReminderLabel}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 w-full sm:w-auto"
            disabled={updatingState || isDisabled || currentLevel >= 3}
            onClick={() => void skipNextReminder()}
          >
            <ForwardIcon className="size-3.5" />
            {t('reminders.actions.skipNext')}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 w-full sm:w-auto"
            disabled={updatingState}
            onClick={() => void toggleDisabled()}
          >
            {updatingState ? <Loader2Icon className="size-3.5 animate-spin" /> : <PowerIcon className="size-3.5" />}
            {isDisabled ? t('reminders.simpleStatus.enable') : t('reminders.simpleStatus.disable')}
          </Button>
          {canDownloadLegalNotice ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 w-full sm:w-auto"
              onClick={() => void downloadLegalNotice()}
            >
              <DownloadIcon className="size-3.5" />
              {t('reminders.actions.downloadNotice')}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  ) : (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        {statusDetailsNode}
        <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
          <Button
            type="button"
            className="w-full sm:w-auto"
            disabled={isDisabled || isInvoicePaid}
            onClick={handleSendClick}
          >
            <SendIcon className="size-4" />
            {sendReminderLabel}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            disabled={updatingState || isDisabled || currentLevel >= 3}
            onClick={() => void skipNextReminder()}
          >
            <ForwardIcon className="size-4" />
            {t('reminders.actions.skipNext')}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            disabled={updatingState}
            onClick={() => void toggleDisabled()}
          >
            {updatingState ? <Loader2Icon className="size-4 animate-spin" /> : <PowerIcon className="size-4" />}
            {isDisabled ? t('reminders.simpleStatus.enable') : t('reminders.simpleStatus.disable')}
          </Button>
          {canDownloadLegalNotice ? (
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => void downloadLegalNotice()}
            >
              <DownloadIcon className="size-4" />
              {t('reminders.actions.downloadNotice')}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );

  const historyNode = (
    <div className="space-y-4 rounded-lg border p-4">
      <h3 className="text-sm font-semibold">{t('reminders.history.title')}</h3>
      {isLoading ? <p className="text-sm text-muted-foreground">{t('reminders.collection.loadingHistory')}</p> : null}
      {!isLoading && error ? <p className="text-sm text-destructive">{resolveTranslatedError(locale, error, t('reminders.collection.historyLoadFailed'))}</p> : null}

      {!isLoading && !error && logs.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('reminders.collection.noHistory')}</p>
      ) : null}

      {logs.length > 0 ? (
        <ol className="space-y-4 border-l pl-4">
          {logs.map((item) => {
            const levelLabel =
              item.level === 1
                ? t('reminders.levels.soft')
                : item.level === 2
                  ? t('reminders.levels.medium')
                  : item.level === 3
                    ? t('reminders.levels.firm')
                    : t('reminders.levels.formalNotice');

            const statusDotClass =
              item.status === 'sent'
                ? 'bg-emerald-500'
                : item.status === 'failed'
                  ? 'bg-destructive'
                  : item.status === 'paused'
                    ? 'bg-amber-500'
                    : item.status === 'resumed'
                      ? 'bg-sky-500'
                      : 'bg-muted-foreground';

            const historyStatusLabel =
              item.status === 'sent'
                ? t('reminders.collection.historyStatus.sent')
                : item.status === 'failed'
                  ? t('reminders.collection.historyStatus.failed')
                  : item.status === 'paused'
                    ? t('reminders.collection.historyStatus.paused')
                    : item.status === 'resumed'
                      ? t('reminders.collection.historyStatus.resumed')
                      : t('reminders.collection.historyStatus.skipped');

            const primaryText = item.subject?.slice(0, 60) ||
              (item.status === 'paused'
                ? t('reminders.history.pausedLine', { level: item.level })
                : item.status === 'resumed'
                  ? t('reminders.history.resumedLine', { level: item.level })
                  : item.status === 'skipped'
                    ? t('reminders.history.skippedLine', { level: item.level })
                    : item.status === 'failed'
                      ? t('reminders.history.failedLine', { level: item.level })
                      : '');

            return (
              <li key={item._id} className="relative space-y-1">
                <span className={cn('absolute -left-[1.18rem] top-1.5 inline-flex size-2.5 rounded-full', statusDotClass)} />
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{levelLabel}</Badge>
                  <span className="text-xs text-muted-foreground">{historyStatusLabel}</span>
                </div>
                {primaryText ? <p className="text-sm font-medium text-foreground">{primaryText}</p> : null}
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {item.status === 'sent' || item.status === 'failed' ? (
                    <span className="inline-flex items-center gap-1">
                      <MailIcon className="size-3.5" />
                      {t('reminders.collection.viaEmail')}
                    </span>
                  ) : null}
                  <span>{computeRelativeDate(item.sentAt, locale)}</span>
                </div>
              </li>
            );
          })}
        </ol>
      ) : null}

      {hasMore ? (
        <Button type="button" variant="outline" onClick={() => void setSize(size + 1)} disabled={isValidating}>
          {isValidating ? t('reminders.collection.loadingMore') : t('reminders.collection.loadMore')}
        </Button>
      ) : null}
    </div>
  );

  const legalRecoveryNode = (() => {
    if (!showControls || !legalRecovery) {
      return null;
    }

    const hasDeadlineWarning = legalRecovery.warningReason === 'formal_notice_deadline_not_reached';
    const requiresFormalNotice = legalRecovery.reason === 'formal_notice_not_sent';

    const thresholdLabel = t('reminders.legalRecovery.thresholdHint', {
      amount: formatEur(legalRecovery.claimThresholdCents, locale),
    });
    const claimLabel = t('reminders.legalRecovery.claimAmount', {
      amount: formatEur(legalRecovery.claimAmountCents, locale),
    });

    let bannerText: string | null = null;
    if (!legalRecovery.eligible) {
      const reason = legalRecovery.reason;
      if (reason === 'formal_notice_not_sent') {
        bannerText = t('reminders.legalRecovery.formalNoticeRequiredMessage');
      } else if (reason === 'formal_notice_deadline_not_reached') {
        bannerText = t('reminders.legalRecovery.ineligible.formal_notice_deadline_not_reached', {
          date: formatSentDate(legalRecovery.formalNoticeDeadline) || '-',
        });
      } else if (reason === 'amount_exceeds_threshold') {
        bannerText = t('reminders.legalRecovery.ineligible.amount_exceeds_threshold', {
          amount: formatEur(legalRecovery.claimAmountCents, locale),
          threshold: Math.round(legalRecovery.claimThresholdCents / 100).toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-GB'),
        });
      } else if (reason === 'invoice_paid') {
        bannerText = t('reminders.legalRecovery.ineligible.invoice_paid');
      } else if (reason === 'amount_is_zero') {
        bannerText = t('reminders.legalRecovery.ineligible.amount_is_zero');
      }
    } else if (hasDeadlineWarning) {
      bannerText = t('reminders.legalRecovery.warning.formal_notice_deadline_not_reached', {
        date: formatSentDate(legalRecovery.formalNoticeDeadline) || '-',
      });
    } else {
      bannerText = t('reminders.legalRecovery.eligibleDescription');
    }

    const initiatedLabel = legalRecovery.legalRecoveryInitiatedAt
      ? t('reminders.legalRecovery.initiatedOn', {
          date: formatSentDate(legalRecovery.legalRecoveryInitiatedAt) || '-',
        })
      : null;

    return (
      <div className={cn('space-y-3 overflow-hidden rounded-lg border p-4', isCompact && 'border-border/70 bg-card p-3')}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2">
            <GavelIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 space-y-0.5">
              <p className="text-sm font-semibold text-foreground">
                {t('reminders.legalRecovery.sectionTitle')}
              </p>
              <p className="break-words text-xs text-muted-foreground">
                {t('reminders.legalRecovery.sectionDescription')}
              </p>
            </div>
          </div>
          {legalRecovery.eligible ? (
            <Badge className="shrink-0 border-0 bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              {t('reminders.legalRecovery.sectionTitle')}
            </Badge>
          ) : null}
        </div>

        {bannerText ? (
          <p
            className={cn(
              'break-words rounded-md border px-3 py-2 text-xs',
              legalRecovery.eligible
                ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200'
                : 'border-border/60 bg-muted/40 text-muted-foreground'
            )}
          >
            {bannerText}
          </p>
        ) : null}

        {requiresFormalNotice ? (
          <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-3 text-xs text-muted-foreground">
            <p className="font-semibold uppercase tracking-[0.08em] text-foreground">
              {t('reminders.legalRecovery.availableOnlyIfTitle')}
            </p>
            <p className="mt-2 break-words">{t('reminders.legalRecovery.availableOnlyIfFormalNotice')}</p>
          </div>
        ) : null}

        {legalRecovery.eligible && legalRecovery.courtConfigured === false ? (
          <div className="flex flex-col gap-2 rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-900 dark:border-orange-900/60 dark:bg-orange-950/30 dark:text-orange-200 sm:flex-row sm:items-center sm:justify-between">
            <span className="min-w-0 break-words">{t('reminders.legalRecovery.configureCourt')}</span>
            <Link
              href="/settings/reminders?section=legalRecovery"
              className="shrink-0 text-xs font-semibold underline-offset-2 hover:underline"
            >
              {t('reminders.actions.openSettings')}
            </Link>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="break-words">{claimLabel}</span>
          <span aria-hidden>•</span>
          <span className="break-words">{thresholdLabel}</span>
          {initiatedLabel ? (
            <>
              <span aria-hidden>•</span>
              <span className="break-words">{initiatedLabel}</span>
            </>
          ) : null}
        </div>

        {legalRecovery.eligible ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button
              type="button"
              size={isCompact ? 'sm' : 'default'}
              className="w-full min-w-0 sm:w-auto"
              disabled={downloadingLegalRecoveryKind !== null}
              onClick={() => void downloadLegalRecoveryArtifact('payment-order')}
            >
              {downloadingLegalRecoveryKind === 'payment-order'
                ? <Loader2Icon className={(isCompact ? 'size-3.5' : 'size-4') + ' animate-spin'} />
                : <DownloadIcon className={isCompact ? 'size-3.5' : 'size-4'} />}
              <span className="truncate">{t('reminders.actions.downloadPaymentOrder')}</span>
            </Button>
            <Button
              type="button"
              size={isCompact ? 'sm' : 'default'}
              variant="outline"
              className="w-full min-w-0 sm:w-auto"
              disabled={downloadingLegalRecoveryKind !== null}
              onClick={() => void downloadLegalRecoveryArtifact('recovery-file')}
            >
              {downloadingLegalRecoveryKind === 'recovery-file'
                ? <Loader2Icon className={(isCompact ? 'size-3.5' : 'size-4') + ' animate-spin'} />
                : <DownloadIcon className={isCompact ? 'size-3.5' : 'size-4'} />}
              <span className="truncate">{t('reminders.actions.downloadRecoveryFile')}</span>
            </Button>
          </div>
        ) : null}
      </div>
    );
  })();

  return (
    <div className={cn((showControls && showHistory) || legalRecoveryNode ? 'space-y-4' : '')}>
      {showControls ? controlsNode : null}
      {legalRecoveryNode}
      {showHistory ? historyNode : null}

      <AlertDialog open={showFormalNoticeConfirm} onOpenChange={setShowFormalNoticeConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('reminders.formalNoticeResendConfirm.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('reminders.formalNoticeResendConfirm.description', {
                date: formalNoticeSentDateLabel || '-',
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('reminders.formalNoticeResendConfirm.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowFormalNoticeConfirm(false);
                setShowSendModal(true);
              }}
            >
              {t('reminders.formalNoticeResendConfirm.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={showLegalRecoveryConfirm}
        onOpenChange={(open) => {
          setShowLegalRecoveryConfirm(open);
          if (!open) {
            setPendingLegalRecoveryKind(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('reminders.legalRecovery.deadlineOverrideConfirm.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('reminders.legalRecovery.deadlineOverrideConfirm.description', {
                date: formatSentDate(legalRecovery?.formalNoticeDeadline) || '-',
                document: pendingLegalRecoveryKind === 'recovery-file'
                  ? t('reminders.actions.downloadRecoveryFile')
                  : t('reminders.actions.downloadPaymentOrder'),
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('reminders.legalRecovery.deadlineOverrideConfirm.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const nextKind = pendingLegalRecoveryKind;
                setShowLegalRecoveryConfirm(false);
                setPendingLegalRecoveryKind(null);
                if (nextKind) {
                  void downloadLegalRecoveryArtifact(nextKind, true);
                }
              }}
            >
              {t('reminders.legalRecovery.deadlineOverrideConfirm.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SendReminderModal
        open={showSendModal}
        onOpenChange={setShowSendModal}
        invoiceId={invoiceId}
        locale={locale}
        nextLevel={nextLevel}
        clientName={clientName}
        invoiceNumber={invoiceNumber}
        dueDate={dueDate}
        invoiceDate={invoiceDate}
        amountDue={amountDue}
        companyName={companyName}
        onSent={async () => {
          await Promise.resolve(onInvoiceRefresh());
          await mutate();
          await refreshLogsCache();
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('reminder-logs:refresh', { detail: { invoiceId } }));
          }
        }}
      />
    </div>
  );
}
