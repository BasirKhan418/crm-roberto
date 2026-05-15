'use client';

import { useEffect, useState } from 'react';

import { Loader2Icon, ReceiptTextIcon } from 'lucide-react';
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

const translations = {
  en: {
    title: 'Convert to invoice',
    description: 'Set due date and notes before converting this signed quote.',
    dueDateLabel: 'Due date',
    dueDateRequired: 'Due date is mandatory',
    notesLabel: 'Notes / terms',
    notesPlaceholder: 'Add invoice notes or payment terms...',
    cancel: 'Cancel',
    submit: 'Convert to invoice',
    converting: 'Converting...',
    success: 'Quote converted to invoice',
    error: 'Failed to convert quote',
  },
  fr: {
    title: 'Convertir en facture',
    description: "Définissez l'échéance et les notes avant la conversion du devis signé.",
    dueDateLabel: '\u00c9ch\u00e9ance',
    dueDateRequired: "L'échéance est obligatoire",
    notesLabel: 'Notes / conditions',
    notesPlaceholder: 'Ajoutez des notes de facture ou conditions de paiement...',
    cancel: 'Annuler',
    submit: 'Convertir en facture',
    converting: 'Conversion...',
    success: 'Devis converti en facture',
    error: 'Impossible de convertir le devis',
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

  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState(initialNotes?.trim() || '');
  const [dueDateError, setDueDateError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    setDueDate('');
    setNotes(initialNotes?.trim() || '');
    setDueDateError(null);
  }, [open, initialNotes]);

  async function handleConvert() {
    if (!dueDate.trim()) {
      setDueDateError(t.dueDateRequired);
      toast.error(t.dueDateRequired);
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteId,
          dueDate,
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
          <div className="space-y-1.5">
            <Label htmlFor="convert-due-date" className="text-xs">{t.dueDateLabel}</Label>
            <Input
              id="convert-due-date"
              type="date"
              value={dueDate}
              onChange={(event) => {
                const nextValue = event.target.value;
                setDueDate(nextValue);
                if (nextValue.trim()) {
                  setDueDateError(null);
                }
              }}
              disabled={submitting}
              aria-invalid={Boolean(dueDateError)}
            />
            {dueDateError ? <p className="text-xs text-destructive">{dueDateError}</p> : null}
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
