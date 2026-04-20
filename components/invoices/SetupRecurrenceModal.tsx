'use client';

import { useEffect, useMemo, useState } from 'react';

import { Loader2Icon } from 'lucide-react';
import { toast } from 'sonner';

import { computeNextOccurrence, type RecurrenceFrequency } from '@/lib/recurrence/core';
import { resolveTranslatedError, translate } from '@/lib/i18n/messages';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';

type Locale = 'en' | 'fr';

interface RecurrenceState {
  frequency?: RecurrenceFrequency | null;
  customIntervalDays?: number | null;
  nextOccurrenceAt?: string | Date | null;
  endDate?: string | Date | null;
  autoGenerate?: boolean;
  autoSend?: boolean;
}

interface SetupRecurrenceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  locale: Locale;
  invoiceDueDate?: string | Date | null;
  initialRecurrence?: RecurrenceState | null;
  onSaved?: () => void;
}

function dateToInputValue(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeInputDate(value?: string | Date | null): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function buildDefaultNextOccurrence(
  dueDate: string | Date | null | undefined,
  frequency: RecurrenceFrequency,
  customIntervalDays: number
): string {
  const anchor = normalizeInputDate(dueDate) ?? new Date();
  return dateToInputValue(computeNextOccurrence(anchor, frequency, customIntervalDays));
}

export default function SetupRecurrenceModal({
  open,
  onOpenChange,
  invoiceId,
  locale,
  invoiceDueDate,
  initialRecurrence,
  onSaved,
}: SetupRecurrenceModalProps) {
  const t = (key: string, replacements?: Record<string, string | number | null | undefined>) =>
    translate(locale, key, replacements);

  const [frequency, setFrequency] = useState<RecurrenceFrequency>('monthly');
  const [customIntervalDays, setCustomIntervalDays] = useState(30);
  const [nextOccurrenceAt, setNextOccurrenceAt] = useState('');
  const [endDate, setEndDate] = useState('');
  const [autoGenerate, setAutoGenerate] = useState(false);
  const [autoSend, setAutoSend] = useState(false);
  const [saving, setSaving] = useState(false);

  const computedDefaultNext = useMemo(
    () => buildDefaultNextOccurrence(invoiceDueDate, frequency, customIntervalDays),
    [customIntervalDays, frequency, invoiceDueDate]
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    const initialFrequency = initialRecurrence?.frequency ?? 'monthly';
    const initialCustomInterval = Math.max(1, Math.round(initialRecurrence?.customIntervalDays ?? 30));

    setFrequency(initialFrequency);
    setCustomIntervalDays(initialCustomInterval);

    const initialNextDate = normalizeInputDate(initialRecurrence?.nextOccurrenceAt);
    setNextOccurrenceAt(
      initialNextDate
        ? dateToInputValue(initialNextDate)
        : buildDefaultNextOccurrence(invoiceDueDate, initialFrequency, initialCustomInterval)
    );

    const initialEndDate = normalizeInputDate(initialRecurrence?.endDate);
    setEndDate(initialEndDate ? dateToInputValue(initialEndDate) : '');

    setAutoGenerate(initialRecurrence?.autoGenerate === true);
    setAutoSend(initialRecurrence?.autoSend === true && initialRecurrence?.autoGenerate === true);
  }, [initialRecurrence, invoiceDueDate, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (!nextOccurrenceAt) {
      setNextOccurrenceAt(computedDefaultNext);
    }
  }, [computedDefaultNext, nextOccurrenceAt, open]);

  async function saveRecurrence() {
    if (saving) {
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(`/api/invoices/${invoiceId}/recurrence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frequency,
          customIntervalDays: frequency === 'custom' ? customIntervalDays : undefined,
          nextOccurrenceAt: new Date(`${nextOccurrenceAt}T12:00:00Z`).toISOString(),
          endDate: endDate ? new Date(`${endDate}T12:00:00Z`).toISOString() : undefined,
          autoGenerate,
          autoSend: autoGenerate ? autoSend : false,
        }),
      });

      const payload = (await response.json()) as { success?: boolean; message?: string };
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || t('recurring.setup.saveFailed'));
      }

      toast.success(t('recurring.setup.saved'));
      onSaved?.();
      onOpenChange(false);
    } catch (error) {
      toast.error(resolveTranslatedError(locale, error, t('recurring.setup.saveFailed')));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('recurring.setup.title')}</DialogTitle>
          <DialogDescription>{t('recurring.setup.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t('recurring.setup.frequency')}</Label>
            <RadioGroup
              value={frequency}
              onValueChange={(value) => {
                const nextFrequency: RecurrenceFrequency =
                  value === 'quarterly' || value === 'yearly' || value === 'custom' ? value : 'monthly';
                setFrequency(nextFrequency);
                setNextOccurrenceAt(buildDefaultNextOccurrence(invoiceDueDate, nextFrequency, customIntervalDays));
              }}
              className="grid grid-cols-1 gap-2 sm:grid-cols-2"
            >
              <Label className="flex items-center gap-2 rounded-lg border p-3 text-sm">
                <RadioGroupItem value="monthly" />
                {t('recurring.frequency.monthly')}
              </Label>
              <Label className="flex items-center gap-2 rounded-lg border p-3 text-sm">
                <RadioGroupItem value="quarterly" />
                {t('recurring.frequency.quarterly')}
              </Label>
              <Label className="flex items-center gap-2 rounded-lg border p-3 text-sm">
                <RadioGroupItem value="yearly" />
                {t('recurring.frequency.yearly')}
              </Label>
              <Label className="flex items-center gap-2 rounded-lg border p-3 text-sm">
                <RadioGroupItem value="custom" />
                {t('recurring.frequency.custom')}
              </Label>
            </RadioGroup>
          </div>

          {frequency === 'custom' ? (
            <div className="space-y-2">
              <Label htmlFor="recurrence-custom-days">{t('recurring.setup.customIntervalDays')}</Label>
              <Input
                id="recurrence-custom-days"
                type="number"
                min={1}
                value={customIntervalDays}
                onChange={(event) => {
                  const next = Math.max(1, Math.round(Number(event.target.value) || 1));
                  setCustomIntervalDays(next);
                  setNextOccurrenceAt(buildDefaultNextOccurrence(invoiceDueDate, frequency, next));
                }}
              />
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="recurrence-next-occurrence">{t('recurring.nextOccurrence')}</Label>
              <Input
                id="recurrence-next-occurrence"
                type="date"
                value={nextOccurrenceAt}
                onChange={(event) => setNextOccurrenceAt(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="recurrence-end-date">{t('recurring.setup.repeatUntilOptional')}</Label>
              <Input
                id="recurrence-end-date"
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-3 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{t('recurring.autoGenerate')}</p>
                <p className="text-xs text-muted-foreground">{t('recurring.setup.autoGenerateHelp')}</p>
              </div>
              <Switch checked={autoGenerate} onCheckedChange={setAutoGenerate} />
            </div>

            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{t('recurring.autoSend')}</p>
                <p className="text-xs text-muted-foreground">{t('recurring.setup.autoSendHelp')}</p>
              </div>
              <Switch
                checked={autoSend}
                disabled={!autoGenerate}
                onCheckedChange={(checked) => setAutoSend(checked && autoGenerate)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
            {t('recurring.setup.cancel')}
          </Button>
          <Button type="button" disabled={saving} onClick={() => void saveRecurrence()}>
            {saving ? <Loader2Icon className="size-4 animate-spin" /> : null}
            {saving ? t('recurring.setup.saving') : t('recurring.setup.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
