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
import { EXPENSE_PAID_BY, EXPENSE_PAYMENT_METHODS } from '@/lib/expenses/constants';
import { getExpensePaidByLabel, getExpensePaymentMethodLabel } from '@/lib/expenses/labels';

type ExpensePaymentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expenseId: string | null;
  amountInclVatCents: number;
  amountPaidCents: number;
  locale: 'en' | 'fr';
  mode?: 'settle' | 'add';
  onSaved: () => Promise<void> | void;
};

export function ExpensePaymentDialog({
  open,
  onOpenChange,
  expenseId,
  amountInclVatCents,
  amountPaidCents,
  locale,
  mode = 'settle',
  onSaved,
}: ExpensePaymentDialogProps) {
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paidBy, setPaidBy] = useState('');
  const [paidAt, setPaidAt] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const remainingCents = Math.max(amountInclVatCents - amountPaidCents, 0);

  useEffect(() => {
    if (!open) return;

    setPaymentMethod('');
    setPaidBy('');
    setPaidAt(new Date().toISOString().slice(0, 10));
    setPaymentAmount(mode === 'add' && remainingCents > 0 ? (remainingCents / 100).toFixed(2) : '');
    setError(null);
    setConfirmOpen(false);
  }, [mode, open, remainingCents]);

  const t = {
    en: {
      titleSettle: 'Settle expense',
      descriptionSettle: 'Record payment method and date. This action settles the full remaining balance.',
      titleAddPayment: 'Add payment',
      descriptionAddPayment: 'Record a partial or full payment with amount, method, payer, and date.',
      remainingLabel: 'Remaining balance',
      dateLabel: 'Paid at',
      methodLabel: 'Payment method',
      paidByLabel: 'Paid by',
      amountLabel: 'Payment amount',
      amountHint: 'You can enter either a partial or full payment.',
      paidByPlaceholder: 'Select payer',
      methodPlaceholder: 'Select a method',
      cancel: 'Cancel',
      submitSettle: 'Settle expense',
      submitAddPayment: 'Add payment',
      sectionTitleSettle: 'Settlement confirmation data',
      sectionTitleAddPayment: 'Payment entry data',
      confirmTitleSettle: 'Confirm settlement',
      confirmDescriptionSettle:
        'This action settles the expense as fully paid using the selected method and date.',
      confirmTitleAddPayment: 'Confirm payment entry',
      confirmDescriptionAddPayment:
        'This action records the entered payment amount and updates the remaining balance.',
      confirmAction: 'Confirm',
      successSettle: 'Expense settled',
      successAddPayment: 'Payment added',
      methodRequired: 'Payment method is required',
      paidByRequired: 'Paid by is required',
      dateRequired: 'Payment date is required',
      amountRequired: 'Payment amount is required',
      amountPositive: 'Payment amount must be greater than zero',
      amountTooHigh: 'Payment amount cannot exceed the remaining balance',
      alreadySettled: 'This expense is already fully paid',
      failedSettle: 'Failed to settle expense',
      failedAddPayment: 'Failed to add payment',
    },
    fr: {
      titleSettle: 'Solder la dépense',
      descriptionSettle: 'Enregistrez le mode et la date. Cette action solde intégralement le restant.',
      titleAddPayment: 'Ajouter un paiement',
      descriptionAddPayment: 'Saisissez un paiement partiel ou total avec montant, mode, payeur et date.',
      remainingLabel: 'Reste à payer',
      dateLabel: 'Date de paiement',
      methodLabel: 'Mode de paiement',
      paidByLabel: 'Payé par',
      amountLabel: 'Montant du paiement',
      amountHint: 'Vous pouvez saisir un paiement partiel ou total.',
      paidByPlaceholder: 'Sélectionner le payeur',
      methodPlaceholder: 'Sélectionner un mode',
      cancel: 'Annuler',
      submitSettle: 'Solder la dépense',
      submitAddPayment: 'Ajouter paiement',
      sectionTitleSettle: 'Données de confirmation du solde',
      sectionTitleAddPayment: 'Données de saisie paiement',
      confirmTitleSettle: 'Confirmer le solde',
      confirmDescriptionSettle:
        'Cette action solde entièrement la dépense avec la date et le mode saisis.',
      confirmTitleAddPayment: 'Confirmer le paiement',
      confirmDescriptionAddPayment:
        'Cette action enregistre le montant saisi et met à jour le reste à payer.',
      confirmAction: 'Confirmer',
      successSettle: 'Dépense soldée',
      successAddPayment: 'Paiement ajouté',
      methodRequired: 'Mode de paiement requis',
      paidByRequired: 'Le champ payé par est requis',
      dateRequired: 'Date de paiement requise',
      amountRequired: 'Montant du paiement requis',
      amountPositive: 'Le montant du paiement doit être supérieur à zéro',
      amountTooHigh: 'Le montant ne peut pas dépasser le reste à payer',
      alreadySettled: 'Cette dépense est déjà intégralement payée',
      failedSettle: 'Échec du solde de la dépense',
      failedAddPayment: 'Échec ajout paiement',
    },
  }[locale];

  const isSettleMode = mode === 'settle';

  function parseAmountToCents() {
    const normalized = paymentAmount.trim().replace(',', '.');
    if (!normalized) {
      return null;
    }

    const numericValue = Number(normalized);
    if (!Number.isFinite(numericValue)) {
      return null;
    }

    return Math.round(numericValue * 100);
  }

  function validateFields() {
    if (!expenseId) return false;

    if (isSettleMode && remainingCents <= 0) {
      setError(t.alreadySettled);
      return false;
    }

    if (!isSettleMode) {
      const amountCents = parseAmountToCents();

      if (amountCents === null) {
        setError(t.amountRequired);
        return false;
      }

      if (amountCents <= 0) {
        setError(t.amountPositive);
        return false;
      }

      if (amountCents > remainingCents) {
        setError(t.amountTooHigh);
        return false;
      }
    }

    if (!paymentMethod) {
      setError(t.methodRequired);
      return false;
    }

    if (!paidBy) {
      setError(t.paidByRequired);
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
      const amountCents = isSettleMode ? null : parseAmountToCents();

      const response = await fetch(`/api/expenses/${expenseId}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: isSettleMode ? 'mark_paid' : 'add_payment',
          amountPaidCents:
            !isSettleMode && typeof amountCents === 'number'
              ? (amountCents / 100).toFixed(2)
              : undefined,
          paidAt,
          paymentMethod,
          paidBy,
        }),
      });

      const result = (await response.json().catch(() => null)) as
        | { success: boolean; message?: string }
        | null;

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || (isSettleMode ? t.failedSettle : t.failedAddPayment));
      }

      await onSaved();
      toast.success(isSettleMode ? t.successSettle : t.successAddPayment);
      onOpenChange(false);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : isSettleMode
            ? t.failedSettle
            : t.failedAddPayment
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isSettleMode ? t.titleSettle : t.titleAddPayment}</DialogTitle>
          <DialogDescription>{isSettleMode ? t.descriptionSettle : t.descriptionAddPayment}</DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border border-border/70 p-4">
          <p className="mb-3 text-sm font-semibold">
            {isSettleMode ? t.sectionTitleSettle : t.sectionTitleAddPayment}
          </p>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>{t.remainingLabel}</Label>
              <p className="rounded-md border border-border/70 bg-muted/20 px-2.5 py-2 text-sm font-medium">
                {(remainingCents / 100).toFixed(2)}
              </p>
            </div>

            {!isSettleMode ? (
              <div className="space-y-1.5">
                <Label>{t.amountLabel}</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={paymentAmount}
                  onChange={(event) => setPaymentAmount(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">{t.amountHint}</p>
              </div>
            ) : null}

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

            <div className="space-y-1.5">
              <Label>{t.paidByLabel}</Label>
              <select
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                value={paidBy}
                onChange={(event) => setPaidBy(event.target.value)}
              >
                <option value="">{t.paidByPlaceholder}</option>
                {EXPENSE_PAID_BY.map((payer) => (
                  <option key={payer} value={payer}>
                    {getExpensePaidByLabel(payer, locale)}
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
            {isSettleMode ? t.submitSettle : t.submitAddPayment}
          </Button>
        </DialogFooter>

        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{isSettleMode ? t.confirmTitleSettle : t.confirmTitleAddPayment}</AlertDialogTitle>
              <AlertDialogDescription>
                {isSettleMode ? t.confirmDescriptionSettle : t.confirmDescriptionAddPayment}
              </AlertDialogDescription>
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
