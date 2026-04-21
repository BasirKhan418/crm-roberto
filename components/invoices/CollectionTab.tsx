'use client';

import { useCallback, useMemo, useState } from 'react';

import useSWRInfinite from 'swr/infinite';
import { Loader2Icon, MailIcon, PowerIcon, SendIcon } from 'lucide-react';
import { toast } from 'sonner';

import SendReminderModal from '@/components/invoices/SendReminderModal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { resolveTranslatedError, translate } from '@/lib/i18n/messages';
import { cn } from '@/lib/utils';

type Locale = 'en' | 'fr';
type ReminderLevel = 0 | 1 | 2 | 3 | 4;
type ReminderLogStatus = 'sent' | 'failed' | 'skipped';

interface ReminderState {
  level?: number | null;
  nextScheduledAt?: string | Date | null;
  isPaused?: boolean;
}

interface ReminderLogItem {
  _id: string;
  level: 1 | 2 | 3 | 4;
  channel: 'email' | 'whatsapp';
  status: ReminderLogStatus;
  subject: string;
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
  clientName?: string | null;
  invoiceNumber?: string | null;
  dueDate?: string | Date | null;
  invoiceDate?: string | Date | null;
  amountDue?: number | null;
  companyName?: string | null;
  reminderState?: ReminderState | null;
  onInvoiceRefresh: () => Promise<void> | void;
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

export default function CollectionTab({
  invoiceId,
  locale,
  clientName,
  invoiceNumber,
  dueDate,
  invoiceDate,
  amountDue,
  companyName,
  reminderState,
  onInvoiceRefresh,
}: CollectionTabProps) {
  const [showSendModal, setShowSendModal] = useState(false);
  const [updatingState, setUpdatingState] = useState(false);

  const t = useCallback(
    (key: string, replacements?: Record<string, string | number | null | undefined>) =>
      translate(locale, key, replacements),
    [locale]
  );

  const currentLevel = Math.max(0, Math.min(4, Math.round(reminderState?.level ?? 0))) as ReminderLevel;
  const isDisabled = reminderState?.isPaused === true;
  const nextLevel = Math.max(1, Math.min(3, currentLevel + 1)) as 1 | 2 | 3;

  const statusLabel = isDisabled
    ? t('reminders.simpleStatus.inactive')
    : t('reminders.simpleStatus.active');

  const statusBadgeClass = isDisabled
    ? 'bg-slate-100 text-slate-700'
    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300';

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

  const getKey = (index: number, previousPageData: ReminderLogsResponse | null) => {
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
    } catch (actionError) {
      toast.error(resolveTranslatedError(locale, actionError, t('reminders.collection.actionFailed')));
    } finally {
      setUpdatingState(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-4 rounded-lg border p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <Badge className={cn('border-0', statusBadgeClass)}>{statusLabel}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{nextScheduledLabel}</p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
            <Button
              type="button"
              className="w-full sm:w-auto"
              disabled={isDisabled || currentLevel >= 4}
              onClick={() => setShowSendModal(true)}
            >
              <SendIcon className="size-4" />
              {t('reminders.actions.sendNow')}
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
          </div>
        </div>
      </div>

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
                    : 'bg-muted-foreground';

              const historyStatusLabel =
                item.status === 'sent'
                  ? t('reminders.collection.historyStatus.sent')
                  : item.status === 'failed'
                    ? t('reminders.collection.historyStatus.failed')
                    : t('reminders.collection.historyStatus.skipped');

              return (
                <li key={item._id} className="relative space-y-1">
                  <span className={cn('absolute -left-[1.18rem] top-1.5 inline-flex size-2.5 rounded-full', statusDotClass)} />
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{levelLabel}</Badge>
                    <span className="text-xs text-muted-foreground">{historyStatusLabel}</span>
                  </div>
                  <p className="text-sm font-medium text-foreground">{item.subject.slice(0, 60)}</p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <MailIcon className="size-3.5" />
                      {t('reminders.collection.viaEmail')}
                    </span>
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
        }}
      />
    </div>
  );
}
