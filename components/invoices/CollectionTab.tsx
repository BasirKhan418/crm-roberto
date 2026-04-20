'use client';

import { useCallback, useMemo, useState } from 'react';

import useSWRInfinite from 'swr/infinite';
import { MailIcon, PauseIcon, PlayIcon, SkipForwardIcon } from 'lucide-react';
import { toast } from 'sonner';

import SendReminderModal from '@/components/invoices/SendReminderModal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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

function getStatusTone(level: ReminderLevel, paused: boolean) {
  if (paused) {
    return {
      labelKey: 'reminders.status.paused',
      badgeClass: 'bg-slate-100 text-slate-700',
    };
  }

  if (level <= 0) {
    return {
      labelKey: 'reminders.status.notStarted',
      badgeClass: 'bg-gray-100 text-gray-700',
    };
  }

  if (level === 1) {
    return {
      labelKey: 'reminders.status.softSent',
      badgeClass: 'bg-yellow-100 text-yellow-700',
    };
  }

  if (level === 2) {
    return {
      labelKey: 'reminders.status.mediumSent',
      badgeClass: 'bg-orange-100 text-orange-700',
    };
  }

  if (level === 3) {
    return {
      labelKey: 'reminders.status.firmSent',
      badgeClass: 'bg-red-100 text-red-700',
    };
  }

  return {
    labelKey: 'reminders.status.formalNoticeSent',
    badgeClass: 'bg-rose-100 text-rose-700',
  };
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
  const isPaused = reminderState?.isPaused === true;

  const nextLevel = Math.max(1, Math.min(3, currentLevel + 1)) as 1 | 2 | 3;

  const statusTone = getStatusTone(currentLevel, isPaused);

  const nextScheduledLabel = useMemo(() => {
    if (isPaused) {
      return t('reminders.status.paused');
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
  }, [currentLevel, isPaused, reminderState?.nextScheduledAt, t]);

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

  async function runStateAction(url: string, successMessage: string) {
    setUpdatingState(true);

    try {
      const response = await fetch(url, { method: 'POST' });
      const payload = (await response.json()) as { success?: boolean; message?: string };
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || t('reminders.collection.actionFailed'));
      }

      toast.success(successMessage);
      await Promise.resolve(onInvoiceRefresh());
      await mutate();
    } catch (actionError) {
      toast.error(resolveTranslatedError(locale, actionError, t('reminders.collection.actionFailed')));
    } finally {
      setUpdatingState(false);
    }
  }

  async function openLegalNoticePdf() {
    window.open(`/api/invoices/${invoiceId}/reminders/legal-notice/pdf`, '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{t('reminders.collection.title')}</CardTitle>
          <CardDescription>{t('reminders.collection.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={cn('border-0', statusTone.badgeClass)}>{t(statusTone.labelKey)}</Badge>
            <p className="text-sm text-muted-foreground">{nextScheduledLabel}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => setShowSendModal(true)}>
              {t('reminders.actions.sendNow')}
            </Button>

            <Button
              type="button"
              variant="outline"
              disabled={updatingState}
              onClick={() =>
                void runStateAction(
                  `/api/invoices/${invoiceId}/reminders/${isPaused ? 'resume' : 'pause'}`,
                  isPaused ? t('reminders.collection.resumeSuccess') : t('reminders.collection.pauseSuccess')
                )
              }
            >
              {isPaused ? <PlayIcon className="size-4" /> : <PauseIcon className="size-4" />}
              {isPaused ? t('reminders.actions.resume') : t('reminders.actions.pause')}
            </Button>

            <Button
              type="button"
              variant="outline"
              disabled={updatingState || currentLevel >= 4}
              onClick={() => void runStateAction(`/api/invoices/${invoiceId}/reminders/skip`, t('reminders.collection.skipSuccess'))}
            >
              <SkipForwardIcon className="size-4" />
              {t('reminders.actions.skipNext')}
            </Button>

            <Button
              type="button"
              variant="outline"
              disabled={currentLevel < 4}
              onClick={() => void openLegalNoticePdf()}
            >
              {t('reminders.actions.downloadNotice')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('reminders.history.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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

                const statusLabel =
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
                      <span className="text-xs text-muted-foreground">{statusLabel}</span>
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
        </CardContent>
      </Card>

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
