'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import Link from 'next/link';
import { useSWRConfig } from 'swr';
import useSWR from 'swr';
import useSWRInfinite from 'swr/infinite';
import { CheckCircle2Icon, CheckIcon, ChevronDownIcon, DownloadIcon, ForwardIcon, GavelIcon, InfoIcon, Loader2Icon, MailIcon, PowerIcon, SendIcon } from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatInvoiceDisplayNumber, resolveTranslatedError, translate } from '@/lib/i18n/messages';
import { cn } from '@/lib/utils';

type Locale = 'en' | 'fr';
type ReminderLevel = 0 | 1 | 2 | 3 | 4;
type ReminderLogStatus = 'sent' | 'failed' | 'skipped' | 'paused' | 'resumed' | 'generated' | 'court_sent';

type LegalRecoveryIneligibleReason =
  | 'invoice_paid'
  | 'formal_notice_not_sent'
  | 'formal_notice_deadline_not_reached'
  | 'amount_exceeds_threshold'
  | 'amount_is_zero';

type LegalRecoveryWarningReason = 'formal_notice_deadline_not_reached';
type LegalRecoveryArtifactKind = 'payment-order' | 'recovery-file';
type LegalRecoveryCourtLocation = 'luxembourg' | 'esch_sur_alzette' | 'diekirch';

interface LegalRecoveryCourtData {
  courtName?: string | null;
  courtAddress?: string | null;
  courtCity?: string | null;
  creditorProfession?: string | null;
  elisantDomicile?: string | null;
  representativeName?: string | null;
  representativeTitle?: string | null;
  additionalNotes?: string | null;
  configured: boolean;
}

interface LegalRecoveryEligibilityData {
  eligible: boolean;
  reason: LegalRecoveryIneligibleReason | null;
  warningReason?: LegalRecoveryWarningReason | null;
  claimAmountCents: number;
  claimThresholdCents: number;
  formalNoticeSentAt?: string | Date | null;
  formalNoticeDeadline?: string | Date | null;
  legalRecoveryInitiatedAt?: string | Date | null;
  legalRecoverySentToCourtAt?: string | Date | null;
  legalRecoveryRegisteredMailNumber?: string | null;
  legalRecoveryRegisteredMailDate?: string | Date | null;
  jurisdiction?: string | null;
  courtLocation?: LegalRecoveryCourtLocation | null;
  courtSelectionRequired?: boolean;
  courtSelected?: boolean;
  selectedCourt?: Omit<LegalRecoveryCourtData, 'configured'>;
  courts?: Partial<Record<LegalRecoveryCourtLocation, LegalRecoveryCourtData>>;
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
  legalRecoverySentToCourtAt?: string | Date | null;
  legalRecoveryRegisteredMailNumber?: string | null;
  legalRecoveryRegisteredMailDate?: string | Date | null;
}

interface ReminderLogItem {
  _id: string;
  level: number;
  channel?: 'email' | 'whatsapp' | null;
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
  const [savingLegalRecoveryCourt, setSavingLegalRecoveryCourt] = useState(false);
  const [selectedLegalRecoveryCourtLocation, setSelectedLegalRecoveryCourtLocation] = useState<LegalRecoveryCourtLocation | null>(null);
  const [updatingState, setUpdatingState] = useState(false);
  const [showCourtDetails, setShowCourtDetails] = useState(false);
  const [markingLegalRecoverySent, setMarkingLegalRecoverySent] = useState(false);
  const [showRegisteredMailModal, setShowRegisteredMailModal] = useState(false);
  const [registeredMailNumber, setRegisteredMailNumber] = useState('');
  const [registeredMailDate, setRegisteredMailDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [registeredMailError, setRegisteredMailError] = useState<string | null>(null);
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
    setSelectedLegalRecoveryCourtLocation((legalRecovery?.courtLocation ?? null) as LegalRecoveryCourtLocation | null);
  }, [legalRecovery?.courtLocation]);

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
      await mutate();
      await refreshLogsCache();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('reminder-logs:refresh', { detail: { invoiceId } }));
      }
    } catch (downloadError) {
      toast.error(resolveTranslatedError(locale, downloadError, t('reminders.legalRecovery.downloadFailed')));
    } finally {
      setDownloadingLegalRecoveryKind(null);
    }
  }

  function openRegisteredMailModal() {
    if (markingLegalRecoverySent) {
      return;
    }
    setRegisteredMailNumber('');
    setRegisteredMailDate(new Date().toISOString().slice(0, 10));
    setRegisteredMailError(null);
    setShowRegisteredMailModal(true);
  }

  async function submitRegisteredMailConfirmation() {
    if (markingLegalRecoverySent) {
      return;
    }

    const trimmedNumber = registeredMailNumber.trim();
    if (!trimmedNumber) {
      setRegisteredMailError(t('reminders.legalRecovery.confirmRegisteredMail.numberRequired'));
      return;
    }
    if (!registeredMailDate) {
      setRegisteredMailError(t('reminders.legalRecovery.confirmRegisteredMail.dateRequired'));
      return;
    }
    const parsedDate = new Date(registeredMailDate);
    if (!Number.isFinite(parsedDate.getTime())) {
      setRegisteredMailError(t('reminders.legalRecovery.confirmRegisteredMail.dateRequired'));
      return;
    }
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    if (parsedDate.getTime() > todayEnd.getTime()) {
      setRegisteredMailError(t('reminders.legalRecovery.confirmRegisteredMail.dateInFuture'));
      return;
    }
    setRegisteredMailError(null);

    setMarkingLegalRecoverySent(true);

    try {
      const response = await fetch(`/api/invoices/${invoiceId}/reminders/legal-recovery/sent-to-court`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registeredMailNumber: trimmedNumber,
          registeredMailDate,
        }),
      });
      const payload = (await response.json()) as { success?: boolean; message?: string };
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || t('reminders.legalRecovery.markSentToCourtFailed'));
      }

      toast.success(t('reminders.legalRecovery.markSentToCourtSuccess'));
      setShowRegisteredMailModal(false);
      await Promise.resolve(onInvoiceRefresh());
      await mutateLegalRecovery();
      await mutate();
      await refreshLogsCache();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('reminder-logs:refresh', { detail: { invoiceId } }));
      }
    } catch (actionError) {
      const message = resolveTranslatedError(locale, actionError, t('reminders.legalRecovery.markSentToCourtFailed'));
      setRegisteredMailError(message);
      toast.error(message);
    } finally {
      setMarkingLegalRecoverySent(false);
    }
  }

  async function updateLegalRecoveryCourtSelection(nextCourtLocation: LegalRecoveryCourtLocation) {
    if (isInvoicePaid || savingLegalRecoveryCourt) {
      return;
    }

    const previousCourtLocation = selectedLegalRecoveryCourtLocation ?? null;
    if (previousCourtLocation === nextCourtLocation) {
      return;
    }

    setSelectedLegalRecoveryCourtLocation(nextCourtLocation);

    setSavingLegalRecoveryCourt(true);

    try {
      const response = await fetch(`/api/invoices/${invoiceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ legalRecoveryCourtLocation: nextCourtLocation }),
      });

      const payload = (await response.json()) as { success?: boolean; message?: string };
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || t('reminders.collection.actionFailed'));
      }

      // No need to call mutateLegalRecovery() here — the courts map already
      // contains the configured state for all courts, so the UI updates
      // correctly via optimistic local state without triggering a full refetch.
    } catch (selectionError) {
      setSelectedLegalRecoveryCourtLocation(previousCourtLocation);
      toast.error(resolveTranslatedError(locale, selectionError, t('reminders.collection.actionFailed')));
    } finally {
      setSavingLegalRecoveryCourt(false);
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
            const itemKey = item._id || `${item.status ?? 'unknown'}-${String(item.sentAt ?? '')}-${String(item.level)}`;
            const isLegalRecoveryHistoryItem = item.status === 'generated' || item.status === 'court_sent';

            const levelLabel = isLegalRecoveryHistoryItem
              ? t('reminders.legalRecovery.historyLabel')
              : item.level === 1
                ? t('reminders.levels.soft')
                : item.level === 2
                  ? t('reminders.levels.medium')
                  : item.level === 3
                    ? t('reminders.levels.firm')
                    : t('reminders.levels.formalNotice');

            const statusDotClass =
              item.status === 'court_sent'
                ? 'bg-emerald-500'
                : item.status === 'generated'
                  ? 'bg-sky-500'
                  : item.status === 'sent'
                ? 'bg-emerald-500'
                : item.status === 'failed'
                  ? 'bg-destructive'
                  : item.status === 'paused'
                    ? 'bg-amber-500'
                    : item.status === 'resumed'
                      ? 'bg-sky-500'
                      : 'bg-muted-foreground';

            const historyStatusLabel =
              item.status === 'generated'
                ? t('reminders.collection.historyStatus.generated')
                : item.status === 'court_sent'
                  ? t('reminders.collection.historyStatus.court_sent')
                  : item.status === 'sent'
                ? t('reminders.collection.historyStatus.sent')
                : item.status === 'failed'
                  ? t('reminders.collection.historyStatus.failed')
                  : item.status === 'paused'
                    ? t('reminders.collection.historyStatus.paused')
                    : item.status === 'resumed'
                      ? t('reminders.collection.historyStatus.resumed')
                      : t('reminders.collection.historyStatus.skipped');

            const primaryText = item.subject?.slice(0, 60) ||
              (item.status === 'generated'
                ? t('reminders.history.legalRecoveryGeneratedLine')
                : item.status === 'court_sent'
                  ? t('reminders.history.legalRecoverySentToCourtLine')
                  : item.status === 'paused'
                    ? t('reminders.history.pausedLine', { level: item.level })
                    : item.status === 'resumed'
                      ? t('reminders.history.resumedLine', { level: item.level })
                      : item.status === 'skipped'
                        ? t('reminders.history.skippedLine', { level: item.level })
                        : item.status === 'failed'
                          ? t('reminders.history.failedLine', { level: item.level })
                          : '');

            return (
              <li key={itemKey} className="relative space-y-1">
                <span className={cn('absolute -left-[1.18rem] top-1.5 inline-flex size-2.5 rounded-full', statusDotClass)} />
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{levelLabel}</Badge>
                  <span className="text-xs text-muted-foreground">{historyStatusLabel}</span>
                </div>
                {primaryText ? <p className="text-sm font-medium text-foreground">{primaryText}</p> : null}
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {(item.status === 'sent' || item.status === 'failed') && item.channel === 'email' ? (
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
    const selectedCourtLocation =
      selectedLegalRecoveryCourtLocation ??
      (legalRecovery.courtLocation ?? null);
    const selectedCourt = selectedCourtLocation
      ? legalRecovery.courts?.[selectedCourtLocation] ?? null
      : null;
    const hasCourtSelection = Boolean(selectedCourtLocation);
    const canGenerateLegalRecoveryDocuments =
      legalRecovery.eligible &&
      hasCourtSelection &&
      selectedCourt?.configured === true;
    const generatedAt = legalRecovery.legalRecoveryInitiatedAt ?? reminderState?.legalRecoveryInitiatedAt ?? null;
    const sentToCourtAt = legalRecovery.legalRecoverySentToCourtAt ?? reminderState?.legalRecoverySentToCourtAt ?? null;
    const registeredMailNumberValue = legalRecovery.legalRecoveryRegisteredMailNumber ?? reminderState?.legalRecoveryRegisteredMailNumber ?? null;
    const registeredMailDateValue = legalRecovery.legalRecoveryRegisteredMailDate ?? reminderState?.legalRecoveryRegisteredMailDate ?? null;
    const registeredMailSummaryLabel = sentToCourtAt && registeredMailNumberValue
      ? t('reminders.legalRecovery.registeredMailSummary', {
          number: registeredMailNumberValue,
          date: formatSentDate(registeredMailDateValue ?? sentToCourtAt) || '-',
        })
      : null;
    const isAmountExceedsThreshold = legalRecovery.reason === 'amount_exceeds_threshold';
    const statusBadgeLabel = legalRecovery.eligible
      ? t('reminders.legalRecovery.statusEligible')
      : t('reminders.legalRecovery.statusNotEligible');

    const thresholdLabel = t('reminders.legalRecovery.thresholdHint', {
      amount: formatEur(legalRecovery.claimThresholdCents, locale),
    });
    const claimLabel = t('reminders.legalRecovery.claimAmount', {
      amount: formatEur(legalRecovery.claimAmountCents, locale),
    });

    let bannerText: string | null = null;
    let nextStepText: string | null = null;
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
          threshold: formatEur(legalRecovery.claimThresholdCents, locale),
        });
        nextStepText = t('reminders.legalRecovery.ineligible.amount_exceeds_threshold_next_step');
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

    const trackingStatusLabel = sentToCourtAt
      ? t('reminders.legalRecovery.trackingSentToCourt')
      : generatedAt
        ? t('reminders.legalRecovery.trackingGenerated')
        : t('reminders.legalRecovery.trackingNotStarted');

    const trackingStatusDateLabel = sentToCourtAt
      ? t('reminders.legalRecovery.sentToCourtOn', {
          date: formatSentDate(sentToCourtAt) || '-',
        })
      : generatedAt
        ? t('reminders.legalRecovery.generatedOn', {
            date: formatSentDate(generatedAt) || '-',
          })
        : null;

    const trackingStatusDescription = sentToCourtAt
      ? t('reminders.legalRecovery.trackingSentToCourtDescription')
      : generatedAt
        ? t('reminders.legalRecovery.trackingGeneratedDescription')
        : t('reminders.legalRecovery.trackingNotStartedDescription');

    const trackingStatusBadgeClass = sentToCourtAt
      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
      : generatedAt
        ? 'bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300'
        : 'bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300';

    return (
      <div className={cn('space-y-3 overflow-hidden rounded-lg border p-4', isCompact && 'border-border/70 bg-card p-3')}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2">
            <GavelIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 space-y-0.5">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <span>{t('reminders.legalRecovery.sectionTitle')}</span>
                <TooltipProvider delayDuration={150}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        aria-label={t('reminders.legalRecovery.steps.infoTooltip')}
                        className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
                      >
                        <InfoIcon className="size-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" align="start" className="max-w-xs text-xs leading-relaxed">
                      {t('reminders.legalRecovery.steps.infoTooltip')}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </p>
            </div>
          </div>
          <Badge
            className={cn(
              'shrink-0 border-0',
              legalRecovery.eligible
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                : 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
            )}
          >
            {statusBadgeLabel}
          </Badge>
        </div>

        {bannerText ? (
          <p
            className={cn(
              'wrap-break-word rounded-md border px-3 py-2 text-xs',
              legalRecovery.eligible
                ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200'
                : isAmountExceedsThreshold
                  ? 'border-orange-200 bg-orange-50 text-orange-900 dark:border-orange-900/60 dark:bg-orange-950/30 dark:text-orange-200'
                : 'border-border/60 bg-muted/40 text-muted-foreground'
            )}
          >
            {bannerText}
          </p>
        ) : null}

        {nextStepText ? (
          <div className="rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-900 dark:border-orange-900/60 dark:bg-orange-950/30 dark:text-orange-200">
            <p className="font-semibold text-foreground">{t('reminders.legalRecovery.nextStepTitle')}</p>
            <p className="mt-1 wrap-break-word">{nextStepText}</p>
          </div>
        ) : null}

        <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                {t('reminders.legalRecovery.trackingLabel')}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={cn('border-0', trackingStatusBadgeClass)}>{trackingStatusLabel}</Badge>
                {trackingStatusDateLabel ? (
                  <span className="text-xs text-muted-foreground">{trackingStatusDateLabel}</span>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">{trackingStatusDescription}</p>
              {registeredMailSummaryLabel ? (
                <p className="flex items-start gap-1 text-xs font-medium text-foreground">
                  <MailIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                  <span className="wrap-break-word">{registeredMailSummaryLabel}</span>
                </p>
              ) : null}
            </div>
          </div>
        </div>

        {requiresFormalNotice ? (
          <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-3 text-xs text-muted-foreground">
            <p className="font-semibold uppercase tracking-[0.08em] text-foreground">
              {t('reminders.legalRecovery.availableOnlyIfTitle')}
            </p>
            <p className="mt-2 wrap-break-word">{t('reminders.legalRecovery.availableOnlyIfFormalNotice')}</p>
          </div>
        ) : null}

        {(() => {
          const step1Done = hasCourtSelection && selectedCourt?.configured === true;
          const step2Done = Boolean(generatedAt);
          const step3Done = Boolean(sentToCourtAt);
          const step2Unlocked = step1Done;
          const step3Unlocked = step2Done;

          const stepHeader = (n: 1 | 2 | 3, title: string, done: boolean, unlocked: boolean) => (
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold',
                  done
                    ? 'border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300'
                    : unlocked
                      ? 'border-primary/40 bg-primary/10 text-primary'
                      : 'border-border bg-muted text-muted-foreground'
                )}
              >
                {done ? <CheckIcon className="size-3.5" /> : n}
              </span>
              <p className={cn('text-sm font-semibold', unlocked || done ? 'text-foreground' : 'text-muted-foreground')}>
                {title}
              </p>
              {done ? (
                <Badge className="border-0 bg-emerald-100 text-[10px] uppercase tracking-wider text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                  {t('reminders.legalRecovery.steps.stepDone')}
                </Badge>
              ) : null}
            </div>
          );

          return (
            <div className="space-y-3">
              {/* Step 1: Select jurisdiction */}
              <div
                className={cn(
                  'rounded-lg border p-3',
                  step1Done ? 'border-emerald-200/60 bg-emerald-50/30 dark:border-emerald-900/40 dark:bg-emerald-950/10' : 'border-border/70 bg-card'
                )}
              >
                {stepHeader(1, t('reminders.legalRecovery.steps.step1Title'), step1Done, true)}
                <p className="mt-1 ml-8 text-xs text-muted-foreground">
                  {t('reminders.legalRecovery.steps.step1Description')}
                </p>
                <div className="mt-3 ml-8 space-y-2">
                  <p className="text-xs font-medium text-foreground">{t('reminders.legalRecovery.courtSelectionLabel')}</p>
                  <Select
                    value={selectedCourtLocation ?? undefined}
                    onValueChange={(value) => {
                      void updateLegalRecoveryCourtSelection(value as LegalRecoveryCourtLocation);
                    }}
                    disabled={isInvoicePaid || savingLegalRecoveryCourt || downloadingLegalRecoveryKind !== null}
                  >
                    <SelectTrigger className="h-9 w-full sm:max-w-sm">
                      <SelectValue placeholder={t('reminders.settings.legalRecoverySection.courtLocationNone')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="luxembourg">
                        {t('reminders.settings.legalRecoverySection.courtLocationLuxembourg')}
                      </SelectItem>
                      <SelectItem value="esch_sur_alzette">
                        {t('reminders.settings.legalRecoverySection.courtLocationEschSurAlzette')}
                      </SelectItem>
                      <SelectItem value="diekirch">
                        {t('reminders.settings.legalRecoverySection.courtLocationDiekirch')}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">{t('reminders.legalRecovery.courtSelectionHelp')}</p>
                  {selectedCourt?.configured ? (
                    <div className="mt-1 rounded-md border border-border/50 bg-muted/30 text-xs text-muted-foreground">
                      <button
                        type="button"
                        onClick={() => setShowCourtDetails((v) => !v)}
                        className="flex w-full items-center justify-between px-3 py-2 text-left"
                      >
                        <span className="font-medium text-foreground">{t('reminders.settings.legalRecoverySection.courtNameLabel')}: {selectedCourt.courtName}</span>
                        <ChevronDownIcon className={cn('h-3.5 w-3.5 shrink-0 transition-transform', showCourtDetails && 'rotate-180')} />
                      </button>
                      {showCourtDetails ? (
                        <div className="border-t border-border/50 px-3 py-2 space-y-0.5">
                          {selectedCourt.courtAddress ? <p>{selectedCourt.courtAddress}{selectedCourt.courtCity ? `, ${selectedCourt.courtCity}` : ''}</p> : null}
                          {selectedCourt.representativeName ? <p><span className="font-medium text-foreground">{t('reminders.settings.legalRecoverySection.representativeNameLabel')}:</span> {selectedCourt.representativeName}{selectedCourt.representativeTitle ? ` — ${selectedCourt.representativeTitle}` : ''}</p> : null}
                          {selectedCourt.creditorProfession ? <p><span className="font-medium text-foreground">{t('reminders.settings.legalRecoverySection.creditorProfessionLabel')}:</span> {selectedCourt.creditorProfession}</p> : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {legalRecovery.eligible && !hasCourtSelection ? (
                    <div className="rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-900 dark:border-orange-900/60 dark:bg-orange-950/30 dark:text-orange-200">
                      <span className="min-w-0 wrap-break-word">{t('reminders.legalRecovery.selectCourtRequired')}</span>
                    </div>
                  ) : null}

                  {legalRecovery.eligible && hasCourtSelection && selectedCourt?.configured === false ? (
                    <div className="flex flex-col gap-2 rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-900 dark:border-orange-900/60 dark:bg-orange-950/30 dark:text-orange-200 sm:flex-row sm:items-center sm:justify-between">
                      <span className="min-w-0 wrap-break-word">{t('reminders.legalRecovery.configureCourt')}</span>
                      <Link
                        href="/settings/reminders?section=legalRecovery"
                        className="shrink-0 text-xs font-semibold underline-offset-2 hover:underline"
                      >
                        {t('reminders.actions.openSettings')}
                      </Link>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Step 2: Download documents */}
              <div
                className={cn(
                  'rounded-lg border p-3',
                  step2Done
                    ? 'border-emerald-200/60 bg-emerald-50/30 dark:border-emerald-900/40 dark:bg-emerald-950/10'
                    : step2Unlocked
                      ? 'border-border/70 bg-card'
                      : 'border-border/60 bg-muted/30 opacity-70'
                )}
                aria-disabled={!step2Unlocked}
              >
                {stepHeader(2, t('reminders.legalRecovery.steps.step2Title'), step2Done, step2Unlocked)}
                <p className="mt-1 ml-8 text-xs text-muted-foreground">
                  {step2Unlocked
                    ? t('reminders.legalRecovery.steps.step2Description')
                    : t('reminders.legalRecovery.steps.step2Locked')}
                </p>
                <div className="mt-3 ml-8 space-y-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="wrap-break-word">{claimLabel}</span>
                    <span aria-hidden>•</span>
                    <span className="wrap-break-word">{thresholdLabel}</span>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    <Button
                      type="button"
                      size={isCompact ? 'sm' : 'default'}
                      className="w-full min-w-0 sm:w-auto"
                      disabled={!step2Unlocked || !canGenerateLegalRecoveryDocuments || downloadingLegalRecoveryKind !== null || savingLegalRecoveryCourt}
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
                      disabled={!step2Unlocked || !canGenerateLegalRecoveryDocuments || downloadingLegalRecoveryKind !== null || savingLegalRecoveryCourt}
                      onClick={() => void downloadLegalRecoveryArtifact('recovery-file')}
                    >
                      {downloadingLegalRecoveryKind === 'recovery-file'
                        ? <Loader2Icon className={(isCompact ? 'size-3.5' : 'size-4') + ' animate-spin'} />
                        : <DownloadIcon className={isCompact ? 'size-3.5' : 'size-4'} />}
                      <span className="truncate">{t('reminders.actions.downloadRecoveryFile')}</span>
                    </Button>
                  </div>
                </div>
              </div>

              {/* Step 3: Mark as sent to court */}
              <div
                className={cn(
                  'rounded-lg border p-3',
                  step3Done
                    ? 'border-emerald-200/60 bg-emerald-50/30 dark:border-emerald-900/40 dark:bg-emerald-950/10'
                    : step3Unlocked
                      ? 'border-border/70 bg-card'
                      : 'border-border/60 bg-muted/30 opacity-70'
                )}
                aria-disabled={!step3Unlocked}
              >
                {stepHeader(3, t('reminders.legalRecovery.steps.step3Title'), step3Done, step3Unlocked)}
                <p className="mt-1 ml-8 text-xs text-muted-foreground">
                  {step3Done
                    ? t('reminders.legalRecovery.steps.step3Done')
                    : step3Unlocked
                      ? t('reminders.legalRecovery.steps.step3Description')
                      : t('reminders.legalRecovery.steps.step3Locked')}
                </p>
                {step3Done ? (
                  registeredMailSummaryLabel ? (
                    <p className="mt-2 ml-8 flex items-start gap-1 text-xs font-medium text-foreground">
                      <MailIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                      <span className="wrap-break-word">{registeredMailSummaryLabel}</span>
                    </p>
                  ) : null
                ) : (
                  <div className="mt-3 ml-8">
                    <Button
                      type="button"
                      size={isCompact ? 'sm' : 'default'}
                      variant="outline"
                      className="w-full min-w-0 sm:w-auto"
                      disabled={!step3Unlocked || markingLegalRecoverySent || downloadingLegalRecoveryKind !== null}
                      onClick={() => openRegisteredMailModal()}
                    >
                      {markingLegalRecoverySent
                        ? <Loader2Icon className={(isCompact ? 'size-3.5' : 'size-4') + ' animate-spin'} />
                        : <CheckCircle2Icon className={isCompact ? 'size-3.5' : 'size-4'} />}
                      <span className="truncate">{t('reminders.legalRecovery.markSentToCourt')}</span>
                    </Button>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </div>
    );
  })();

  return (
    <div className={cn('min-w-0', (showControls && showHistory) || legalRecoveryNode ? 'space-y-4' : '')}>
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

      <Dialog
        open={showRegisteredMailModal}
        onOpenChange={(open) => {
          if (markingLegalRecoverySent) {
            return;
          }
          setShowRegisteredMailModal(open);
          if (!open) {
            setRegisteredMailError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MailIcon className="size-4" />
              {t('reminders.legalRecovery.confirmRegisteredMail.title')}
            </DialogTitle>
            <DialogDescription>
              {t('reminders.legalRecovery.confirmRegisteredMail.description')}
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void submitRegisteredMailConfirmation();
            }}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="registered-mail-number">
                  {t('reminders.legalRecovery.confirmRegisteredMail.numberLabel')}
                  <span className="ml-0.5 text-rose-600">*</span>
                </Label>
                <Input
                  id="registered-mail-number"
                  value={registeredMailNumber}
                  onChange={(event) => setRegisteredMailNumber(event.target.value)}
                  placeholder={t('reminders.legalRecovery.confirmRegisteredMail.numberPlaceholder')}
                  maxLength={64}
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="registered-mail-date">
                  {t('reminders.legalRecovery.confirmRegisteredMail.dateLabel')}
                  <span className="ml-0.5 text-rose-600">*</span>
                </Label>
                <Input
                  id="registered-mail-date"
                  type="date"
                  value={registeredMailDate}
                  onChange={(event) => setRegisteredMailDate(event.target.value)}
                  max={new Date().toISOString().slice(0, 10)}
                  required
                />
              </div>
            </div>

            <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-3">
              <p className="text-xs font-medium text-foreground">
                {t('reminders.legalRecovery.confirmRegisteredMail.findHint')}
              </p>
              <div className="mt-2 flex justify-center">
                <div className="rounded-md border border-border/70 bg-background p-3 text-center text-[11px] text-muted-foreground">
                  <div className="flex items-center justify-center gap-2">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded bg-yellow-300 font-bold text-black">R</span>
                    <div className="text-left leading-tight">
                      <p className="text-[10px] font-semibold text-foreground">LUXEMBOURG</p>
                      <p className="text-[10px]">0205 30267</p>
                    </div>
                  </div>
                  <div className="mt-2 inline-block rounded border border-blue-500 px-2 py-0.5 font-mono text-[11px] font-semibold text-foreground">
                    RR 0205 30267 LU
                  </div>
                </div>
              </div>
            </div>

            {registeredMailError ? (
              <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
                {registeredMailError}
              </p>
            ) : null}

            <DialogFooter className="gap-2 sm:gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={markingLegalRecoverySent}
                onClick={() => setShowRegisteredMailModal(false)}
              >
                {t('reminders.legalRecovery.confirmRegisteredMail.cancel')}
              </Button>
              <Button type="submit" disabled={markingLegalRecoverySent}>
                {markingLegalRecoverySent ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : (
                  <CheckCircle2Icon className="size-4" />
                )}
                <span>{t('reminders.legalRecovery.confirmRegisteredMail.submit')}</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
