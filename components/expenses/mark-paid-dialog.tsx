'use client';

import { useEffect, useState } from 'react';

import { Loader2Icon } from 'lucide-react';

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
import { EXPENSE_PAYMENT_METHODS } from '@/lib/expenses/constants';

type MarkPaidDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expenseId: string | null;
  amountInclVatCents: number;
  amountPaidCents: number;
  locale: 'en' | 'fr';
  onSaved: () => Promise<void> | void;
};

export function MarkPaidDialog({
  open,
  onOpenChange,
  expenseId,
  amountInclVatCents,
  amountPaidCents,
  locale,
  onSaved,
}: MarkPaidDialogProps) {
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paidAt, setPaidAt] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remainingCents = Math.max(amountInclVatCents - amountPaidCents, 0);

  useEffect(() => {
    if (!open) return;

    setPaymentMethod('');
    setPaidAt(new Date().toISOString().slice(0, 10));
    setError(null);
  }, [open]);

  const t = {
    en: {
      title: 'Mark Expense as Paid',
      description: 'Record payment method and date. This action marks the full remaining balance as paid.',
      remainingLabel: 'Remaining balance',
      dateLabel: 'Paid at',
      methodLabel: 'Payment method',
      cancel: 'Cancel',
      submit: 'Apply payment',
      methodRequired: 'Payment method is required',
      dateRequired: 'Payment date is required',
      failed: 'Failed to mark expense as paid',
    },
    fr: {
      title: 'Marquer la depense payee',
      description: 'Enregistrez le mode et la date. Cette action solde integralement la depense.',
      remainingLabel: 'Reste a payer',
      dateLabel: 'Date de paiement',
      methodLabel: 'Mode de paiement',
      cancel: 'Annuler',
      submit: 'Appliquer paiement',
      methodRequired: 'Mode de paiement requis',
      dateRequired: 'Date de paiement requise',
      failed: 'Echec mise a jour paiement',
    },
  }[locale];

  async function handleSubmit() {
    if (!expenseId) return;

    if (!paymentMethod) {
      setError(t.methodRequired);
      return;
    }

    if (!paidAt) {
      setError(t.dateRequired);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/expenses/${expenseId}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'mark_paid',
          paidAt,
          paymentMethod,
        }),
      });

      const result = (await response.json().catch(() => null)) as
        | { success: boolean; message?: string }
        | null;

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || t.failed);
      }

      await onSaved();
      onOpenChange(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t.failed);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription>{t.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>{t.remainingLabel}</Label>
            <p className="rounded-md border border-border/70 bg-muted/20 px-2.5 py-2 text-sm font-medium">
              {(remainingCents / 100).toFixed(2)}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>{t.dateLabel}</Label>
            <Input type="date" value={paidAt} onChange={(event) => setPaidAt(event.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>{t.methodLabel}</Label>
            <select
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
              value={paymentMethod}
              onChange={(event) => setPaymentMethod(event.target.value)}
            >
              <option value="">-</option>
              {EXPENSE_PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            {t.cancel}
          </Button>
          <Button type="button" onClick={() => void handleSubmit()} disabled={saving || !expenseId}>
            {saving ? <Loader2Icon className="size-4 animate-spin" /> : null}
            {t.submit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
