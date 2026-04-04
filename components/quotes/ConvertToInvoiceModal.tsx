'use client';

import { useEffect, useMemo, useState } from 'react';

import { Loader2Icon, ReceiptTextIcon, X } from 'lucide-react';
import { toast } from 'sonner';

import { resolveTranslatedError } from '@/lib/i18n/messages';
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

type Locale = 'en' | 'fr';

interface ConvertToInvoiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quoteId: string;
  quoteNumber: string;
  initialNotes?: string | null;
  locale: Locale;
  onConverted?: (invoiceId: string) => void;
}

const PRESET_DEPOSITS = [5, 10, 20, 30, 50, 80, 100] as const;

const translations = {
  en: {
    title: 'Convert to invoice',
    description: 'Set billing preferences before converting this signed quote.',
    depositLabel: 'Deposit %',
    dueDateLabel: 'Due date (optional)',
    notesLabel: 'Notes / terms',
    notesPlaceholder: 'Add invoice notes or payment terms...',
    customLabel: 'Custom',
    cancel: 'Cancel',
    submit: 'Convert to invoice',
    converting: 'Converting...',
    success: 'Quote converted to invoice',
    error: 'Failed to convert quote',
    customInvalid: 'Custom deposit must be between 0 and 100',
  },
  fr: {
    title: 'Convertir en facture',
    description: 'D\u00e9finissez les param\u00e8tres de facturation avant conversion du devis sign\u00e9.',
    depositLabel: 'Acompte\u00a0%',
    dueDateLabel: '\u00c9ch\u00e9ance (optionnelle)',
    notesLabel: 'Notes / conditions',
    notesPlaceholder: 'Ajoutez des notes de facture ou conditions de paiement...',
    customLabel: 'Personnalis\u00e9',
    cancel: 'Annuler',
    submit: 'Convertir en facture',
    converting: 'Conversion...',
    success: 'Devis converti en facture',
    error: 'Impossible de convertir le devis',
    customInvalid: "L'acompte personnalis\u00e9 doit \u00eatre entre 0 et 100",
  },
};

export default function ConvertToInvoiceModal({
  open,
  onOpenChange,
  quoteId,
  quoteNumber,
  initialNotes,
  locale,
  onConverted,
}: ConvertToInvoiceModalProps) {
  const t = translations[locale];

  const [selectedDeposit, setSelectedDeposit] = useState<number>(100);
  const [isCustomDeposit, setIsCustomDeposit] = useState(false);
  const [customDeposit, setCustomDeposit] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState(initialNotes?.trim() || '');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    setSelectedDeposit(100);
    setIsCustomDeposit(false);
    setCustomDeposit('');
    setDueDate('');
    setNotes(initialNotes?.trim() || '');
  }, [open, initialNotes]);

  const resolvedDeposit = useMemo(() => {
    if (!isCustomDeposit) {
      return selectedDeposit;
    }

    const parsed = Number(customDeposit);
    if (!Number.isFinite(parsed)) {
      return NaN;
    }

    return Math.round(parsed);
  }, [isCustomDeposit, selectedDeposit, customDeposit]);

  async function handleConvert() {
    if (isCustomDeposit && (!Number.isFinite(resolvedDeposit) || resolvedDeposit < 0 || resolvedDeposit > 100)) {
      toast.error(t.customInvalid);
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteId,
          depositPercentage: resolvedDeposit,
          dueDate: dueDate || null,
          notes: notes.trim() || null,
        }),
      });

      const payload = (await response.json()) as {
        _id?: string | { toString?: () => string };
        message?: string;
        data?: { _id?: string | { toString?: () => string } };
      };
      if (!response.ok) {
        throw new Error(payload.message || t.error);
      }

      const rawId = payload.data?._id ?? payload._id;
      const newId = typeof rawId === 'string' ? rawId : rawId?.toString?.();
      if (!newId) {
        throw new Error(t.error);
      }

      toast.success(t.success);
      onConverted?.(newId);
      onOpenChange(false);
    } catch (error) {
      toast.error(resolveTranslatedError(locale, error, t.error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-lg p-4 sm:p-5">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="absolute top-3 right-3"
          aria-label={t.cancel}
          onClick={() => onOpenChange(false)}
          disabled={submitting}
        >
          <X className="size-4" />
        </Button>

        <DialogHeader className="pr-8">
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <ReceiptTextIcon className="size-4" />
            {t.title}
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            {t.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs">{t.depositLabel}</Label>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
              {PRESET_DEPOSITS.map((value) => {
                const active = !isCustomDeposit && selectedDeposit === value;
                return (
                  <Button
                    key={value}
                    type="button"
                    variant={active ? 'default' : 'outline'}
                    size="sm"
                    className="h-8"
                    onClick={() => {
                      setSelectedDeposit(value);
                      setIsCustomDeposit(false);
                    }}
                    disabled={submitting}
                  >
                    {value}%
                  </Button>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant={isCustomDeposit ? 'default' : 'outline'}
                size="sm"
                className="h-8"
                onClick={() => setIsCustomDeposit(true)}
                disabled={submitting}
              >
                {t.customLabel}
              </Button>
              <Input
                type="number"
                min={0}
                max={100}
                value={customDeposit}
                onChange={(event) => setCustomDeposit(event.target.value)}
                className="h-8"
                placeholder="0-100"
                disabled={submitting || !isCustomDeposit}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="convert-due-date" className="text-xs">{t.dueDateLabel}</Label>
            <Input
              id="convert-due-date"
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              disabled={submitting}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="convert-notes" className="text-xs">{t.notesLabel}</Label>
            <textarea
              id="convert-notes"
              className="min-h-28 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder={t.notesPlaceholder}
              disabled={submitting}
            />
            <p className="text-xs text-muted-foreground">{quoteNumber}</p>
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            {t.cancel}
          </Button>
          <Button type="button" onClick={handleConvert} disabled={submitting}>
            {submitting ? <Loader2Icon className="size-4 animate-spin" /> : null}
            {submitting ? t.converting : t.submit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
