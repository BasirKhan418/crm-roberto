'use client';

import { useState } from 'react';
import Link from 'next/link';

import { CalendarClockIcon, Loader2Icon, PencilIcon, PowerIcon, RefreshCwIcon, Repeat2Icon } from 'lucide-react';
import { toast } from 'sonner';

import SetupRecurrenceModal from '@/components/invoices/SetupRecurrenceModal';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { resolveTranslatedError, translate } from '@/lib/i18n/messages';
import { cn } from '@/lib/utils';

type Locale = 'en' | 'fr';
type RecurrenceFrequency = 'monthly' | 'quarterly' | 'yearly' | 'custom';

interface RecurrenceTemplateLineItem {
  productId?: string | null;
  productImageUrl?: string | null;
  name: string;
  quantity: number;
  baseUnitPriceExcludingTax: number;
  unitPriceExcludingTax: number;
  discountPercentage: number;
  vatRate: number;
}

interface RecurrenceTemplate {
  lineItems: RecurrenceTemplateLineItem[];
  depositPercentage?: number | null;
  notes?: string | null;
  totalIncludingTax?: number | null;
}

interface RecurrenceState {
  isActive?: boolean;
  frequency?: RecurrenceFrequency | null;
  customIntervalDays?: number | null;
  nextOccurrenceAt?: string | Date | null;
  lastGeneratedAt?: string | Date | null;
  lastGeneratedInvoiceId?: string | null;
  endDate?: string | Date | null;
  stoppedAt?: string | Date | null;
  stoppedReason?: string | null;
  autoGenerate?: boolean;
  autoSend?: boolean;
  template?: RecurrenceTemplate | null;
}

interface SourceInvoiceSnapshot {
  lineItems: RecurrenceTemplateLineItem[];
  depositPercentage?: number | null;
  notes?: string | null;
}

interface RecurrenceCardProps {
  invoiceId: string;
  locale: Locale;
  invoiceDueDate?: string | Date | null;
  recurrence?: RecurrenceState | null;
  sourceInvoice?: SourceInvoiceSnapshot | null;
  onInvoiceRefresh: () => Promise<void> | void;
  compact?: boolean;
}

function formatDate(value: string | Date | null | undefined, locale: Locale): string {
  if (!value) {
    return '-';
  }

  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    return '-';
  }

  return new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
}

function formatRelativeDate(value: string | Date | null | undefined, locale: Locale): string {
  if (!value) {
    return '-';
  }

  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    return '-';
  }

  const diffDays = Math.floor((Date.now() - parsed.getTime()) / 86400000);
  if (diffDays <= 0) {
    return locale === 'fr' ? 'Aujourd\'hui' : 'Today';
  }

  if (diffDays === 1) {
    return locale === 'fr' ? 'Il y a 1 jour' : '1 day ago';
  }

  return locale === 'fr' ? `Il y a ${diffDays} jours` : `${diffDays} days ago`;
}

export default function RecurrenceCard({
  invoiceId,
  locale,
  invoiceDueDate,
  recurrence,
  sourceInvoice,
  onInvoiceRefresh,
  compact = false,
}: RecurrenceCardProps) {
  const t = (key: string, replacements?: Record<string, string | number | null | undefined>) =>
    translate(locale, key, replacements);

  const [showSetupModal, setShowSetupModal] = useState(false);
  const [showStopDialog, setShowStopDialog] = useState(false);
  const [stopReason, setStopReason] = useState('');
  const [stopping, setStopping] = useState(false);
  const [generating, setGenerating] = useState(false);

  const isActive = recurrence?.isActive === true;
  const isStopped = recurrence?.isActive === false && Boolean(recurrence?.stoppedAt);
  const isNeverConfigured = !isActive && !isStopped;
  const hasCustomTemplate = Boolean(
    recurrence?.template && Array.isArray(recurrence.template.lineItems) && recurrence.template.lineItems.length > 0
  );

  async function generateNow() {
    if (generating) {
      return;
    }

    setGenerating(true);

    try {
      const response = await fetch(`/api/invoices/${invoiceId}/recurrence/generate`, { method: 'POST' });
      const payload = (await response.json()) as { success?: boolean; message?: string };
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || t('recurring.generateFailed'));
      }

      toast.success(t('recurring.generated'));
      await Promise.resolve(onInvoiceRefresh());
    } catch (error) {
      toast.error(resolveTranslatedError(locale, error, t('recurring.generateFailed')));
    } finally {
      setGenerating(false);
    }
  }

  async function stopRecurrence() {
    if (stopping) {
      return;
    }

    setStopping(true);

    try {
      const response = await fetch(`/api/invoices/${invoiceId}/recurrence`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: stopReason.trim() || undefined }),
      });

      const payload = (await response.json()) as { success?: boolean; message?: string };
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || t('recurring.stopFailed'));
      }

      toast.success(t('recurring.stopped'));
      setShowStopDialog(false);
      setStopReason('');
      await Promise.resolve(onInvoiceRefresh());
    } catch (error) {
      toast.error(resolveTranslatedError(locale, error, t('recurring.stopFailed')));
    } finally {
      setStopping(false);
    }
  }

  const setupModalNode = (
    <SetupRecurrenceModal
      open={showSetupModal}
      onOpenChange={setShowSetupModal}
      invoiceId={invoiceId}
      locale={locale}
      invoiceDueDate={invoiceDueDate}
      initialRecurrence={recurrence}
      sourceInvoice={sourceInvoice}
      onSaved={async () => {
        await Promise.resolve(onInvoiceRefresh());
      }}
    />
  );

  if (isNeverConfigured) {
    return (
      <>
        {compact ? (
          <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 p-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-slate-100 text-slate-700">
                    {t('recurring.status.inactive')}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{t('recurring.card.empty')}</p>
              </div>
              <Button type="button" size="sm" className="h-8 w-full sm:w-auto" onClick={() => setShowSetupModal(true)}>
                <Repeat2Icon className="size-3.5" />
                {t('recurring.setupCta')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 rounded-lg border border-dashed bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
                <Repeat2Icon className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-slate-100 text-slate-700">
                    {t('recurring.status.inactive')}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{t('recurring.card.empty')}</p>
              </div>
            </div>
            <Button type="button" className="w-full sm:w-auto" onClick={() => setShowSetupModal(true)}>
              {t('recurring.setupCta')}
            </Button>
          </div>
        )}

        {setupModalNode}
      </>
    );
  }

  if (isStopped) {
    return (
      <>
        {compact ? (
          <div className="rounded-lg border border-border/70 bg-card p-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="bg-slate-100 text-slate-700">
                    {t('recurring.status.inactive')}
                  </Badge>
                  <p className="text-sm text-muted-foreground">
                    {t('recurring.stoppedOn', { date: formatDate(recurrence?.stoppedAt, locale) })}
                  </p>
                </div>
                {recurrence?.stoppedReason ? (
                  <p className="text-sm text-muted-foreground">{recurrence.stoppedReason}</p>
                ) : null}
              </div>
              <Button type="button" size="sm" className="h-8 w-full sm:w-auto" onClick={() => setShowSetupModal(true)}>
                <RefreshCwIcon className="size-3.5" />
                {t('recurring.restart')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 rounded-lg border p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="bg-slate-100 text-slate-700">
                {t('recurring.status.inactive')}
              </Badge>
              <p className="text-sm text-muted-foreground">
                {t('recurring.stoppedOn', { date: formatDate(recurrence?.stoppedAt, locale) })}
              </p>
            </div>
            {recurrence?.stoppedReason ? (
              <p className="text-sm text-muted-foreground">{recurrence.stoppedReason}</p>
            ) : null}
            <Button type="button" className="w-full sm:w-auto" onClick={() => setShowSetupModal(true)}>
              <RefreshCwIcon className="size-4" />
              {t('recurring.restart')}
            </Button>
          </div>
        )}

        {setupModalNode}
      </>
    );
  }

  return (
    <>
      {compact ? (
        <div className="rounded-lg border border-border/70 bg-card p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300">
                  {t('recurring.status.active')}
                </Badge>
                <Badge variant="outline">{t(`recurring.frequency.${recurrence?.frequency ?? 'monthly'}`)}</Badge>
                {hasCustomTemplate ? (
                  <Badge variant="outline" className="border-primary/30 text-primary">
                    {t('recurring.status.customTemplate')}
                  </Badge>
                ) : null}
              </div>
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <CalendarClockIcon className="size-3.5 shrink-0" />
                <span>{t('recurring.nextOccurrenceLabel', { date: formatDate(recurrence?.nextOccurrenceAt, locale) })}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {t('recurring.lastGenerated')}: {formatRelativeDate(recurrence?.lastGeneratedAt, locale)}
              </p>
              {!recurrence?.autoSend ? (
                <p className="text-xs text-amber-800 dark:text-amber-200">{t('recurring.card.manualValidationNotice')}</p>
              ) : null}
            </div>
            <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
              <Button type="button" size="sm" className="h-8 w-full sm:w-auto" disabled={generating} onClick={() => void generateNow()}>
                {generating ? <Loader2Icon className="size-3.5 animate-spin" /> : null}
                {t('recurring.generateNow')}
              </Button>
              <Button type="button" size="sm" variant="outline" className="h-8 w-full sm:w-auto" onClick={() => setShowSetupModal(true)}>
                <PencilIcon className="size-3.5" />
                {t('recurring.actions.edit')}
              </Button>
              <Button type="button" size="sm" variant="outline" className="h-8 w-full sm:w-auto" onClick={() => setShowStopDialog(true)}>
                <PowerIcon className="size-3.5" />
                {t('recurring.actions.disable')}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4 rounded-lg border p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300">
                  {t('recurring.status.active')}
                </Badge>
                <Badge variant="outline">{t(`recurring.frequency.${recurrence?.frequency ?? 'monthly'}`)}</Badge>
                {hasCustomTemplate ? (
                  <Badge variant="outline" className="border-primary/30 text-primary">
                    {t('recurring.status.customTemplate')}
                  </Badge>
                ) : null}
              </div>
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <CalendarClockIcon className="size-3.5 shrink-0" />
                <span>{t('recurring.nextOccurrenceLabel', { date: formatDate(recurrence?.nextOccurrenceAt, locale) })}</span>
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
              <Button type="button" variant="default" className="w-full sm:w-auto" disabled={generating} onClick={() => void generateNow()}>
                {generating ? <Loader2Icon className="size-4 animate-spin" /> : null}
                {t('recurring.generateNow')}
              </Button>
              <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => setShowSetupModal(true)}>
                <PencilIcon className="size-4" />
                {t('recurring.actions.edit')}
              </Button>
              <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => setShowStopDialog(true)}>
                <PowerIcon className="size-4" />
                {t('recurring.actions.disable')}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 rounded-md bg-muted/30 p-3 sm:grid-cols-3 sm:gap-4">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{t('recurring.autoGenerate')}</p>
              <p className={cn('text-sm font-medium', recurrence?.autoGenerate ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground')}>
                {recurrence?.autoGenerate ? t('common.on') : t('common.off')}
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{t('recurring.autoSend')}</p>
              <p className={cn('text-sm font-medium', recurrence?.autoSend ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground')}>
                {recurrence?.autoSend ? t('common.on') : t('common.off')}
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{t('recurring.lastGenerated')}</p>
              <p className="text-sm font-medium">{formatRelativeDate(recurrence?.lastGeneratedAt, locale)}</p>
              {recurrence?.lastGeneratedInvoiceId ? (
                <Link href={`/invoices/${recurrence.lastGeneratedInvoiceId}`} className="text-xs text-primary hover:underline">
                  {t('recurring.lastGeneratedInvoice')}
                </Link>
              ) : null}
            </div>
          </div>

          {!recurrence?.autoSend ? (
            <p className="rounded-md border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
              {t('recurring.card.manualValidationNotice')}
            </p>
          ) : null}
        </div>
      )}

      {setupModalNode}

      <AlertDialog open={showStopDialog} onOpenChange={setShowStopDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('recurring.stopDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('recurring.stopDialog.description')}</AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2">
            <Label htmlFor="recurrence-stop-reason">{t('recurring.actions.stopReason')}</Label>
            <Textarea
              id="recurrence-stop-reason"
              rows={4}
              value={stopReason}
              onChange={(event) => setStopReason(event.target.value)}
              placeholder={t('recurring.stopDialog.reasonPlaceholder')}
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button type="button" variant="outline" disabled={stopping}>
                {t('recurring.stopDialog.cancel')}
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button type="button" variant="destructive" disabled={stopping} onClick={() => void stopRecurrence()}>
                {stopping ? <Loader2Icon className="size-4 animate-spin" /> : null}
                {t('recurring.stopDialog.confirm')}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
