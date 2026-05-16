'use client';

import { useEffect, useState } from 'react';

import { Loader2Icon } from 'lucide-react';
import { toast } from 'sonner';

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
import { getExpensePaymentMethodLabel } from '@/lib/expenses/labels';

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
  const [confirmOpen, setConfirmOpen] = useState(false);

  const remainingCents = Math.max(amountInclVatCents - amountPaidCents, 0);

  useEffect(() => {
    if (!open) return;

    setPaymentMethod('');
    setPaidAt(new Date().toISOString().slice(0, 10));
    setError(null);
    setConfirmOpen(false);
  }, [open]);

  const t = {
    en: {
      title: 'Mark Expense as Paid',
      description: 'Record payment method and date. This action marks the full remaining balance as paid.',
      remainingLabel: 'Remaining balance',
      dateLabel: 'Paid at',
      methodLabel: 'Payment method',
      methodPlaceholder: 'Select a method',
      cancel: 'Cancel',
      submit: 'Apply payment',
      sectionTitle: 'Payment confirmation data',
      confirmTitle: 'Confirm mark as paid',
      confirmDescription:
        'This action marks the expense as fully paid using the selected method and date.',
      confirmAction: 'Confirm',
      success: 'Expense marked as paid',
      methodRequired: 'Payment method is required',
      dateRequired: 'Payment date is required',
      failed: 'Failed to mark expense as paid',
    },
    fr: {
      title: 'Marquer la dépense payée',
      description: 'Enregistrez le mode et la date. Cette action solde intégralement la dépense.',
      remainingLabel: 'Reste à payer',
      dateLabel: 'Date de paiement',
      methodLabel: 'Mode de paiement',
      methodPlaceholder: 'Sélectionner un mode',
      cancel: 'Annuler',
      submit: 'Appliquer paiement',
      sectionTitle: 'Données de confirmation paiement',
      confirmTitle: 'Confirmer marquage payé',
      confirmDescription:
        'Cette action marque la dépense comme intégralement payée avec la date et le mode saisis.',
      confirmAction: 'Confirmer',
      success: 'Dépense marquée payée',
      methodRequired: 'Mode de paiement requis',
      dateRequired: 'Date de paiement requise',
      failed: 'Échec mise à jour paiement',
    },
  }[locale];

  function validateFields() {
    if (!expenseId) return false;

    if (!paymentMethod) {
      setError(t.methodRequired);
      return false;
    }

    if (!paidAt) {
      setError(t.dateRequired);
      return false;
    }

    return true;
  }

  function requestSubmit() {
    if (!validateFields()) {
      return;
    }

    setConfirmOpen(true);
  }

  async function handleSubmit() {
    if (!validateFields()) {
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
      toast.success(t.success);
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

        <div className="rounded-xl border border-border/70 p-4">
          <p className="mb-3 text-sm font-semibold">{t.sectionTitle}</p>

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
              <option value="">{t.methodPlaceholder}</option>
              {EXPENSE_PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>
                  {getExpensePaymentMethodLabel(method, locale)}
                </option>
              ))}
            </select>
          </div>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            {t.cancel}
          </Button>
          <Button type="button" onClick={requestSubmit} disabled={saving || !expenseId}>
            {saving ? <Loader2Icon className="size-4 animate-spin" /> : null}
            {t.submit}
          </Button>
        </DialogFooter>

        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t.confirmTitle}</AlertDialogTitle>
              <AlertDialogDescription>{t.confirmDescription}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel asChild>
                <Button type="button" variant="outline" disabled={saving}>
                  {t.cancel}
                </Button>
              </AlertDialogCancel>
              <AlertDialogAction asChild>
                <Button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    setConfirmOpen(false);
                    void handleSubmit();
                  }}
                >
                  {saving ? <Loader2Icon className="size-4 animate-spin" /> : null}
                  {t.confirmAction}
                </Button>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
