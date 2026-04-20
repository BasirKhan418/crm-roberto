'use client';

import { useState } from 'react';
import Link from 'next/link';

import { Loader2Icon, RefreshCwIcon, Repeat2Icon } from 'lucide-react';
import { toast } from 'sonner';

import SetupRecurrenceModal from '@/components/invoices/SetupRecurrenceModal';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { resolveTranslatedError, translate } from '@/lib/i18n/messages';

type Locale = 'en' | 'fr';
type RecurrenceFrequency = 'monthly' | 'quarterly' | 'yearly' | 'custom';

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
}

interface RecurrenceCardProps {
  invoiceId: string;
  locale: Locale;
  invoiceDueDate?: string | Date | null;
  recurrence?: RecurrenceState | null;
  onInvoiceRefresh: () => Promise<void> | void;
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
  onInvoiceRefresh,
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

  if (isNeverConfigured) {
    return (
      <>
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-start gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="inline-flex size-10 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
                <Repeat2Icon className="size-5" />
              </div>
              <p className="text-sm font-medium">{t('recurring.card.empty')}</p>
            </div>
            <Button type="button" onClick={() => setShowSetupModal(true)}>
              {t('recurring.setupCta')}
            </Button>
          </CardContent>
        </Card>

        <SetupRecurrenceModal
          open={showSetupModal}
          onOpenChange={setShowSetupModal}
          invoiceId={invoiceId}
          locale={locale}
          invoiceDueDate={invoiceDueDate}
          onSaved={async () => {
            await Promise.resolve(onInvoiceRefresh());
          }}
        />
      </>
    );
  }

  if (isStopped) {
    return (
      <>
        <Card>
          <CardContent className="space-y-3 py-5">
            <p className="text-sm font-medium">
              {t('recurring.stoppedOn', { date: formatDate(recurrence?.stoppedAt, locale) })}
            </p>
            {recurrence?.stoppedReason ? <p className="text-sm text-muted-foreground">{recurrence.stoppedReason}</p> : null}
            <Button type="button" onClick={() => setShowSetupModal(true)}>
              <RefreshCwIcon className="size-4" />
              {t('recurring.restart')}
            </Button>
          </CardContent>
        </Card>

        <SetupRecurrenceModal
          open={showSetupModal}
          onOpenChange={setShowSetupModal}
          invoiceId={invoiceId}
          locale={locale}
          invoiceDueDate={invoiceDueDate}
          initialRecurrence={recurrence}
          onSaved={async () => {
            await Promise.resolve(onInvoiceRefresh());
          }}
        />
      </>
    );
  }

  return (
    <>
      <Card>
        <CardContent className="space-y-4 py-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('recurring.card.title')}</p>
              <Badge className="bg-primary/10 text-primary hover:bg-primary/10">
                {t(`recurring.frequency.${recurrence?.frequency ?? 'monthly'}`)}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" disabled={generating} onClick={() => void generateNow()}>
                {generating ? <Loader2Icon className="size-4 animate-spin" /> : null}
                {t('recurring.generateNow')}
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowStopDialog(true)}>
                {t('recurring.actions.stop')}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">{t('recurring.nextOccurrence')}</p>
              <p className="text-sm font-medium">{formatDate(recurrence?.nextOccurrenceAt, locale)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('recurring.lastGenerated')}</p>
              <p className="text-sm font-medium">{formatRelativeDate(recurrence?.lastGeneratedAt, locale)}</p>
              {recurrence?.lastGeneratedInvoiceId ? (
                <Link href={`/invoices/${recurrence.lastGeneratedInvoiceId}`} className="text-xs text-primary hover:underline">
                  {t('recurring.lastGeneratedInvoice')}
                </Link>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      <SetupRecurrenceModal
        open={showSetupModal}
        onOpenChange={setShowSetupModal}
        invoiceId={invoiceId}
        locale={locale}
        invoiceDueDate={invoiceDueDate}
        initialRecurrence={recurrence}
        onSaved={async () => {
          await Promise.resolve(onInvoiceRefresh());
        }}
      />

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
