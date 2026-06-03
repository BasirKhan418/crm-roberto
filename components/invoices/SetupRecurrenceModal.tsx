'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { Loader2Icon } from 'lucide-react';
import { toast } from 'sonner';

import LineItemsBuilder from '@/components/quotes/LineItemsBuilder';
import type { QuoteLineItem } from '@/components/quotes/LineItemRow';
import QuoteTotals from '@/components/quotes/QuoteTotals';
import { resolveTranslatedError, translate } from '@/lib/i18n/messages';
import { computeQuoteTotals } from '@/lib/quote-calculations';
import { getRecurrenceScheduleValidationKey } from '@/lib/recurrence/validation';
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
import { Textarea } from '@/components/ui/textarea';

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
}

interface RecurrenceState {
  frequency?: RecurrenceFrequency | null;
  customIntervalDays?: number | null;
  nextOccurrenceAt?: string | Date | null;
  endDate?: string | Date | null;
  autoGenerate?: boolean;
  autoSend?: boolean;
  template?: RecurrenceTemplate | null;
}

interface SourceInvoiceSnapshot {
  lineItems: RecurrenceTemplateLineItem[];
  depositPercentage?: number | null;
  notes?: string | null;
}

interface SetupRecurrenceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  locale: Locale;
  invoiceDueDate?: string | Date | null;
  initialRecurrence?: RecurrenceState | null;
  sourceInvoice?: SourceInvoiceSnapshot | null;
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

function computeNextOccurrence(baseDate: Date, frequency: RecurrenceFrequency, customIntervalDays?: number | null): Date {
  const result = new Date(baseDate);

  if (frequency === 'monthly') {
    result.setUTCMonth(result.getUTCMonth() + 1);
    return result;
  }

  if (frequency === 'quarterly') {
    result.setUTCMonth(result.getUTCMonth() + 3);
    return result;
  }

  if (frequency === 'yearly') {
    result.setUTCFullYear(result.getUTCFullYear() + 1);
    return result;
  }

  result.setUTCDate(result.getUTCDate() + Math.max(1, Math.round(customIntervalDays ?? 1)));
  return result;
}

function buildDefaultNextOccurrence(
  dueDate: string | Date | null | undefined,
  frequency: RecurrenceFrequency,
  customIntervalDays: number
): string {
  const anchor = normalizeInputDate(dueDate) ?? new Date();
  return dateToInputValue(computeNextOccurrence(anchor, frequency, customIntervalDays));
}

function cloneLineItems(items: RecurrenceTemplateLineItem[] | undefined | null): QuoteLineItem[] {
  if (!items) {
    return [];
  }

  return items.map((item) => ({
    productId: item.productId ?? null,
    productImageUrl: item.productImageUrl ?? null,
    name: item.name,
    quantity: Math.max(1, Math.round(item.quantity)),
    baseUnitPriceExcludingTax: Math.max(0, Math.round(item.baseUnitPriceExcludingTax ?? item.unitPriceExcludingTax ?? 0)),
    unitPriceExcludingTax: Math.max(0, Math.round(item.unitPriceExcludingTax ?? 0)),
    discountPercentage: Math.max(0, Math.min(100, Number(item.discountPercentage) || 0)),
    vatRate: Math.max(0, Math.min(100, Number(item.vatRate) || 0)),
  }));
}

export default function SetupRecurrenceModal({
  open,
  onOpenChange,
  invoiceId,
  locale,
  invoiceDueDate,
  initialRecurrence,
  sourceInvoice,
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
  const [customizeTemplate, setCustomizeTemplate] = useState(false);
  const [templateLineItems, setTemplateLineItems] = useState<QuoteLineItem[]>([]);
  const [templateDepositPercentage, setTemplateDepositPercentage] = useState<number>(100);
  const [templateNotes, setTemplateNotes] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const initializedSessionKeyRef = useRef<string | null>(null);

  const computedDefaultNext = useMemo(
    () => buildDefaultNextOccurrence(invoiceDueDate, frequency, customIntervalDays),
    [customIntervalDays, frequency, invoiceDueDate]
  );

  useEffect(() => {
    if (!open) {
      initializedSessionKeyRef.current = null;
      return;
    }

    const sessionKey = `recurrence:${invoiceId}`;
    if (initializedSessionKeyRef.current === sessionKey) {
      return;
    }
    initializedSessionKeyRef.current = sessionKey;

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

    const template = initialRecurrence?.template ?? null;
    const hasTemplate = Boolean(template && Array.isArray(template.lineItems) && template.lineItems.length > 0);
    setCustomizeTemplate(hasTemplate);

    if (hasTemplate && template) {
      setTemplateLineItems(cloneLineItems(template.lineItems));
      setTemplateDepositPercentage(
        typeof template.depositPercentage === 'number' ? template.depositPercentage : 100
      );
      setTemplateNotes(template.notes ?? '');
    } else {
      setTemplateLineItems(cloneLineItems(sourceInvoice?.lineItems));
      setTemplateDepositPercentage(
        typeof sourceInvoice?.depositPercentage === 'number' ? sourceInvoice.depositPercentage : 100
      );
      setTemplateNotes(sourceInvoice?.notes ?? '');
    }
  }, [initialRecurrence, invoiceDueDate, invoiceId, open, sourceInvoice]);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (!nextOccurrenceAt) {
      setNextOccurrenceAt(computedDefaultNext);
    }
  }, [computedDefaultNext, nextOccurrenceAt, open]);

  const computedTotals = useMemo(
    () =>
      computeQuoteTotals(
        templateLineItems.map((item) => ({
          quantity: item.quantity,
          unitPriceExcludingTax: item.unitPriceExcludingTax,
          baseUnitPriceExcludingTax: item.baseUnitPriceExcludingTax,
          discountPercentage: item.discountPercentage,
          vatRate: item.vatRate,
        }))
      ),
    [templateLineItems]
  );

  const scheduleValidationKey = useMemo(
    () => getRecurrenceScheduleValidationKey({ nextOccurrenceAt, endDate }),
    [endDate, nextOccurrenceAt]
  );

  async function saveRecurrence() {
    if (saving) {
      return;
    }

    if (scheduleValidationKey) {
      toast.error(t(scheduleValidationKey));
      return;
    }

    if (frequency === 'custom' && (!Number.isFinite(customIntervalDays) || customIntervalDays < 1)) {
      toast.error(t('validation.recurrenceCustomIntervalRequired'));
      return;
    }

    if (customizeTemplate) {
      if (templateLineItems.length === 0) {
        toast.error(t('recurring.setup.templateNoItems'));
        return;
      }

      const invalid = templateLineItems.some((item) => !item.name.trim());
      if (invalid) {
        toast.error(t('recurring.setup.templateInvalidItem'));
        return;
      }
    }

    setSaving(true);

    try {
      let templatePayload: Record<string, unknown> | null = null;

      if (customizeTemplate) {
        const normalizedItems = templateLineItems.map((item) => {
          const baseUnit = Math.max(0, Math.round(item.baseUnitPriceExcludingTax ?? item.unitPriceExcludingTax));
          const unit = Math.max(0, Math.round(item.unitPriceExcludingTax));
          const qty = Math.max(1, Math.round(item.quantity));
          const vatRate = Math.max(0, Math.min(100, Number(item.vatRate) || 0));
          const totalGross = baseUnit * qty;
          const totalNet = unit * qty;
          const discountAmount = Math.max(0, totalGross - totalNet);
          const vatAmount = Math.round(totalNet * (vatRate / 100));
          return {
            productId: item.productId ?? null,
            productImageUrl: item.productImageUrl ?? null,
            name: item.name.trim(),
            quantity: qty,
            baseUnitPriceExcludingTax: baseUnit,
            unitPriceExcludingTax: unit,
            discountPercentage: Math.max(0, Math.min(100, Number(item.discountPercentage) || 0)),
            vatRate,
            totalExcludingTaxBeforeDiscount: totalGross,
            discountAmountExcludingTax: discountAmount,
            totalExcludingTax: totalNet,
            vatAmount,
            totalIncludingTax: totalNet + vatAmount,
          };
        });

        templatePayload = {
          lineItems: normalizedItems,
          totalExcludingTax: computedTotals.totalExcludingTax,
          totalVat: computedTotals.totalVat,
          totalIncludingTax: computedTotals.totalIncludingTax,
          depositPercentage: Math.max(0, Math.min(100, Number(templateDepositPercentage) || 0)),
          notes: templateNotes.trim() || null,
        };
      }

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
          template: templatePayload,
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
      <DialogContent className="max-h-[90vh] w-full max-w-[calc(100vw-2rem)] overflow-x-hidden overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t('recurring.setup.title')}</DialogTitle>
          <DialogDescription>{t('recurring.setup.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <section className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold">{t('recurring.setup.scheduleSection')}</h3>
              <p className="text-xs text-muted-foreground">{t('recurring.setup.scheduleSectionHelp')}</p>
            </div>

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
                  min={nextOccurrenceAt || undefined}
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                />
              </div>
            </div>

            {scheduleValidationKey ? (
              <p className="text-xs text-destructive">{t(scheduleValidationKey)}</p>
            ) : null}
          </section>

          <section className="space-y-3 rounded-lg border p-4">
            <div>
              <h3 className="text-sm font-semibold">{t('recurring.setup.automationSection')}</h3>
              <p className="text-xs text-muted-foreground">{t('recurring.setup.automationSectionHelp')}</p>
            </div>

            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{t('recurring.autoGenerate')}</p>
                <p className="text-xs text-muted-foreground">{t('recurring.setup.autoGenerateHelp')}</p>
              </div>
              <Switch
                checked={autoGenerate}
                onCheckedChange={(checked) => {
                  setAutoGenerate(checked);
                  if (!checked) {
                    setAutoSend(false);
                  }
                }}
              />
            </div>

            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{t('recurring.autoSend')}</p>
                <p className="text-xs text-muted-foreground">{t('recurring.setup.autoSendHelp')}</p>
              </div>
              <Switch
                checked={autoSend && autoGenerate}
                disabled={!autoGenerate}
                onCheckedChange={(checked) => setAutoSend(checked && autoGenerate)}
              />
            </div>

            {!autoSend ? (
              <p className="rounded-md border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
                {t('recurring.setup.manualValidationNotice')}
              </p>
            ) : null}
          </section>

          <section className="space-y-4 rounded-lg border p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold">{t('recurring.setup.templateSection')}</h3>
                <p className="text-xs text-muted-foreground">{t('recurring.setup.templateSectionHelp')}</p>
              </div>
              <Switch checked={customizeTemplate} onCheckedChange={setCustomizeTemplate} />
            </div>

            {customizeTemplate ? (
              <div className="space-y-4">
                <div>
                  <Label className="mb-2 block text-sm">{t('recurring.setup.templateLineItems')}</Label>
                  <LineItemsBuilder mode="invoice" lineItems={templateLineItems} onChange={setTemplateLineItems} />
                </div>

                <QuoteTotals lineItems={templateLineItems} />

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="recurrence-template-deposit">{t('recurring.setup.templateDeposit')}</Label>
                    <Input
                      id="recurrence-template-deposit"
                      type="number"
                      min={0}
                      max={100}
                      value={templateDepositPercentage}
                      onChange={(event) => {
                        const next = Math.max(0, Math.min(100, Math.round(Number(event.target.value) || 0)));
                        setTemplateDepositPercentage(next);
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="recurrence-template-notes">{t('recurring.setup.templateNotes')}</Label>
                    <Textarea
                      id="recurrence-template-notes"
                      rows={3}
                      value={templateNotes}
                      onChange={(event) => setTemplateNotes(event.target.value)}
                      placeholder={t('recurring.setup.templateNotesPlaceholder')}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">{t('recurring.setup.templateFallbackHelp')}</p>
            )}
          </section>
        </div>

        <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:gap-3">
          <Button type="button" variant="outline" className="w-full sm:w-auto" disabled={saving} onClick={() => onOpenChange(false)}>
            {t('recurring.setup.cancel')}
          </Button>
          <Button type="button" className="w-full sm:w-auto" disabled={saving} onClick={() => void saveRecurrence()}>
            {saving ? <Loader2Icon className="size-4 animate-spin" /> : null}
            {saving ? t('recurring.setup.saving') : t('recurring.setup.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
