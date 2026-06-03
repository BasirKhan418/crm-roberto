'use client';

import { useEffect, useState } from 'react';

import { AlertTriangleIcon, ExternalLinkIcon, Loader2Icon } from 'lucide-react';
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
import { InteractiveReceiptImage } from '@/components/expenses/interactive-receipt-image';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EXPENSE_PAID_BY, EXPENSE_PAYMENT_METHODS } from '@/lib/expenses/constants';
import { getExpensePaidByLabel, getExpensePaymentMethodLabel } from '@/lib/expenses/labels';
import { cn } from '@/lib/utils';

type ExpensePaymentDialogAttachment = {
  displayName: string;
  mimeType: string;
  url: string;
};

type ExpensePaymentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expenseId: string | null;
  amountInclVatCents: number;
  amountPaidCents: number;
  locale: 'en' | 'fr';
  mode?: 'settle' | 'add';
  expenseLabel?: string | null;
  expenseDate?: string | Date | null;
  supplierRef?: string | null;
  receiptAttachment?: ExpensePaymentDialogAttachment | null;
  blockedReason?: string | null;
  onCompleteExpense?: () => void;
  onSaved: () => Promise<void> | void;
};

function isImageMimeType(mimeType?: string) {
  return typeof mimeType === 'string' && mimeType.startsWith('image/');
}

function isPdfMimeType(mimeType?: string) {
  return mimeType === 'application/pdf';
}

function toInputDateFromDate(value: Date) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function sanitizeDecimalInput(value: string) {
  return value.replace(/[^\d.,]/g, '');
}

export function ExpensePaymentDialog({
  open,
  onOpenChange,
  expenseId,
  amountInclVatCents,
  amountPaidCents,
  locale,
  mode = 'settle',
  expenseLabel,
  expenseDate,
  supplierRef,
  receiptAttachment,
  blockedReason,
  onCompleteExpense,
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
    setPaidAt(toInputDateFromDate(new Date()));
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
      contextTitle: 'Expense context',
      contextTitleSettle: 'Expense to settle',
      contextTitleAddPayment: 'Expense to pay',
      supplierLabel: 'Supplier',
      expenseDateLabel: 'Expense date',
      referenceLabel: 'Reference',
      totalLabel: 'Total incl. VAT',
      paidLabel: 'Paid to date',
      blockedTitle: 'Complete expense first',
      blockedDescription: 'Payments become available after the expense has a date, category, and TTC amount.',
      completeExpenseAction: 'Complete expense',
      pendingCompletion: 'Pending completion',
      availableAfterCompletion: 'Available after completion',
      receiptTitle: 'Receipt',
      openReceipt: 'Open receipt',
      receiptPreviewUnavailable: 'This receipt type cannot be previewed inline.',
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
      confirmSummaryEnteredAmount: 'Payment to record',
      confirmSummaryRemaining: 'Remaining after confirmation',
      confirmActionSettle: 'Settle now',
      confirmActionAddPayment: 'Record payment',
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
      contextTitle: 'Contexte dépense',
      contextTitleSettle: 'Dépense à solder',
      contextTitleAddPayment: 'Dépense à payer',
      supplierLabel: 'Fournisseur',
      expenseDateLabel: 'Date dépense',
      referenceLabel: 'Référence',
      totalLabel: 'Total TTC',
      paidLabel: 'Déjà payé',
      blockedTitle: "Complétez la dépense d'abord",
      blockedDescription: 'Les paiements sont disponibles après la date, la catégorie et le montant TTC.',
      completeExpenseAction: 'Compléter la dépense',
      pendingCompletion: 'À compléter',
      availableAfterCompletion: 'Disponible après finalisation',
      receiptTitle: 'Reçu',
      openReceipt: 'Ouvrir le reçu',
      receiptPreviewUnavailable: 'Ce type de reçu ne peut pas être prévisualisé ici.',
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
      confirmSummaryEnteredAmount: 'Paiement à enregistrer',
      confirmSummaryRemaining: 'Reste après confirmation',
      confirmActionSettle: 'Solder maintenant',
      confirmActionAddPayment: 'Enregistrer le paiement',
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
  const priceLocale = locale === 'fr' ? 'fr-FR' : 'en-GB';
  const isBlocked = Boolean(blockedReason);

  function formatDateForDisplay(value?: string | Date | null) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return new Intl.DateTimeFormat(priceLocale).format(date);
  }

  function formatEuro(cents: number) {
    return new Intl.NumberFormat(priceLocale, {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(cents / 100);
  }

  const contextTitle = isSettleMode ? t.contextTitleSettle : t.contextTitleAddPayment;
  const totalDisplay = isBlocked && amountInclVatCents <= 0 ? t.pendingCompletion : formatEuro(amountInclVatCents);
  const paidDisplay = isBlocked && amountInclVatCents <= 0 ? '-' : formatEuro(amountPaidCents);
  const remainingDisplay = isBlocked ? t.availableAfterCompletion : formatEuro(remainingCents);

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

    if (blockedReason) {
      setError(blockedReason);
      return false;
    }

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

  const enteredAmountCents = isSettleMode ? remainingCents : parseAmountToCents() ?? 0;
  const remainingAfterConfirmCents = isSettleMode
    ? 0
    : Math.max(0, remainingCents - Math.max(0, enteredAmountCents));

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
      <DialogContent
        data-disable-keyboard-scroll="true"
        className={cn(
          '[--app-keyboard-inset-height:0px] max-h-[92dvh] w-[calc(100%-1rem)] gap-3 p-4 pr-4 sm:gap-4 sm:p-5 sm:pr-12',
          receiptAttachment
            ? 'flex h-[92dvh] flex-col overflow-hidden sm:max-w-5xl lg:max-w-6xl'
            : 'overflow-y-auto sm:max-w-xl'
        )}
      >
        <DialogHeader className="pr-8">
          <DialogTitle>{isSettleMode ? t.titleSettle : t.titleAddPayment}</DialogTitle>
          <DialogDescription>{isSettleMode ? t.descriptionSettle : t.descriptionAddPayment}</DialogDescription>
        </DialogHeader>

        <div
          className={cn(
            receiptAttachment
              ? 'flex min-h-0 flex-1 flex-col gap-3 md:grid md:grid-cols-[minmax(0,1.1fr)_minmax(260px,0.9fr)] lg:grid-cols-[minmax(0,1fr)_minmax(340px,0.9fr)]'
              : 'space-y-3'
          )}
        >
          {receiptAttachment ? (
            <aside className="order-1 flex h-[34dvh] min-h-40 shrink-0 flex-col rounded-xl border border-sky-200/75 bg-sky-50/55 p-3 dark:border-sky-900/40 dark:bg-sky-950/18 md:order-2 md:h-full md:min-h-0">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-semibold">{t.receiptTitle}</p>
                <Button asChild type="button" variant="outline" size="sm" className="h-8 shrink-0 px-2 text-xs">
                  <a href={receiptAttachment.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLinkIcon className="size-3.5" />
                    <span className="hidden sm:inline">{t.openReceipt}</span>
                  </a>
                </Button>
              </div>
              <div className="mt-3 min-h-0 flex-1 overflow-hidden rounded-lg border border-border/70 bg-background">
                {isImageMimeType(receiptAttachment.mimeType) ? (
                  <InteractiveReceiptImage
                    src={receiptAttachment.url}
                    alt={receiptAttachment.displayName}
                    locale={locale}
                    maxScale={8}
                    className="h-full w-full rounded-none border-0"
                  />
                ) : isPdfMimeType(receiptAttachment.mimeType) ? (
                  <iframe src={receiptAttachment.url} title={receiptAttachment.displayName} className="h-full w-full" />
                ) : (
                  <div className="flex h-full flex-col justify-center gap-1 p-3 text-sm">
                    <p className="truncate font-medium">{receiptAttachment.displayName}</p>
                    <p className="text-xs text-muted-foreground">{t.receiptPreviewUnavailable}</p>
                  </div>
                )}
              </div>
            </aside>
          ) : null}

          <div className={cn('space-y-3', receiptAttachment && 'order-2 min-h-0 overflow-y-auto pr-1 md:order-1')}>
            <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
              <p className="text-sm font-semibold">{contextTitle}</p>
              <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                <div>
                  <p className="text-muted-foreground">{t.supplierLabel}</p>
                  <p className="truncate font-medium">{expenseLabel || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t.expenseDateLabel}</p>
                  <p className="font-medium">{formatDateForDisplay(expenseDate)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t.referenceLabel}</p>
                  <p className="truncate font-medium">{supplierRef || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t.remainingLabel}</p>
                  <p className={cn('font-semibold tabular-nums', isBlocked && 'text-muted-foreground')}>
                    {remainingDisplay}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t.totalLabel}</p>
                  <p className={cn('font-semibold tabular-nums', isBlocked && amountInclVatCents <= 0 && 'text-muted-foreground')}>
                    {totalDisplay}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t.paidLabel}</p>
                  <p className="font-semibold tabular-nums">{paidDisplay}</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border/70 p-4">
              <p className="mb-3 text-sm font-semibold">
                {isSettleMode ? t.sectionTitleSettle : t.sectionTitleAddPayment}
              </p>

              {isBlocked ? (
                <div className="rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-3 text-sm text-amber-900 dark:border-amber-900/45 dark:bg-amber-950/25 dark:text-amber-200">
                  <div className="flex items-start gap-2">
                    <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
                    <div className="min-w-0 space-y-1">
                      <p className="font-semibold">{t.blockedTitle}</p>
                      <p>{blockedReason}</p>
                      <p className="text-xs text-amber-800/85 dark:text-amber-200/85">{t.blockedDescription}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>{t.remainingLabel}</Label>
                    <p className="rounded-md border border-border/70 bg-muted/20 px-2.5 py-2 text-sm font-medium">
                      {formatEuro(remainingCents)}
                    </p>
                  </div>

                  {!isSettleMode ? (
                    <div className="space-y-1.5">
                      <Label>{t.amountLabel}</Label>
                      <Input
                        inputMode="decimal"
                        autoComplete="off"
                        value={paymentAmount}
                        onChange={(event) => setPaymentAmount(sanitizeDecimalInput(event.target.value))}
                        disabled={saving}
                      />
                      <p className="text-xs text-muted-foreground">{t.amountHint}</p>
                    </div>
                  ) : null}

                  <div className="space-y-1.5">
                    <Label>{t.dateLabel}</Label>
                    <Input
                      type="date"
                      value={paidAt}
                      onChange={(event) => setPaidAt(event.target.value)}
                      disabled={saving}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>{t.methodLabel}</Label>
                    <select
                      className="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                      value={paymentMethod}
                      onChange={(event) => setPaymentMethod(event.target.value)}
                      disabled={saving}
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
                      className="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                      value={paidBy}
                      onChange={(event) => setPaidBy(event.target.value)}
                      disabled={saving}
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
              )}

              {error ? <p className="text-sm text-destructive">{error}</p> : null}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-3">
          <Button
            type="button"
            variant="ghost"
            className="h-auto w-full whitespace-normal px-3 py-2 text-center sm:h-8 sm:w-auto sm:whitespace-nowrap"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            {t.cancel}
          </Button>
          {isBlocked ? (
            onCompleteExpense ? (
              <Button
                type="button"
                onClick={onCompleteExpense}
                disabled={saving}
                className="h-auto w-full whitespace-normal px-3 py-2 text-center sm:h-8 sm:w-auto sm:whitespace-nowrap"
              >
                {t.completeExpenseAction}
              </Button>
            ) : null
          ) : (
            <Button
              type="button"
              onClick={requestSubmit}
              disabled={saving || !expenseId || remainingCents <= 0}
              className={`h-auto w-full whitespace-normal px-3 py-2 text-center sm:h-8 sm:w-auto sm:whitespace-nowrap ${
                isSettleMode
                  ? 'bg-orange-500 text-white hover:bg-orange-600 hover:text-white'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700 hover:text-white'
              }`}
            >
              {saving ? <Loader2Icon className="size-4 animate-spin" /> : null}
              {isSettleMode ? t.submitSettle : t.submitAddPayment}
            </Button>
          )}
        </DialogFooter>

        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent className="w-[calc(100%-1rem)] gap-3 p-4 pr-4 sm:gap-4 sm:p-5 sm:pr-12">
            <AlertDialogHeader className="pr-8">
              <AlertDialogTitle>{isSettleMode ? t.confirmTitleSettle : t.confirmTitleAddPayment}</AlertDialogTitle>
              <AlertDialogDescription>
                {isSettleMode ? t.confirmDescriptionSettle : t.confirmDescriptionAddPayment}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="rounded-lg border border-border/70 bg-muted/20 p-3 text-sm">
              <div className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-muted-foreground">{t.confirmSummaryEnteredAmount}</span>
                <span className="font-semibold tabular-nums">{formatEuro(Math.max(0, enteredAmountCents))}</span>
              </div>
              <div className="mt-1.5 flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-muted-foreground">{t.confirmSummaryRemaining}</span>
                <span className="font-semibold tabular-nums">{formatEuro(remainingAfterConfirmCents)}</span>
              </div>
            </div>
            <AlertDialogFooter className="gap-3">
              <AlertDialogCancel asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="h-auto w-full whitespace-normal px-3 py-2 text-center sm:h-8 sm:w-auto sm:whitespace-nowrap"
                  disabled={saving}
                >
                  {t.cancel}
                </Button>
              </AlertDialogCancel>
              <AlertDialogAction asChild>
                <Button
                  type="button"
                  className={`h-auto w-full whitespace-normal px-3 py-2 text-center sm:h-8 sm:w-auto sm:whitespace-nowrap ${
                    isSettleMode
                      ? 'bg-orange-500 text-white hover:bg-orange-600 hover:text-white'
                      : 'bg-emerald-600 text-white hover:bg-emerald-700 hover:text-white'
                  }`}
                  disabled={saving || isBlocked}
                  onClick={() => {
                    setConfirmOpen(false);
                    void handleSubmit();
                  }}
                >
                  {saving ? <Loader2Icon className="size-4 animate-spin" /> : null}
                  {isSettleMode ? t.confirmActionSettle : t.confirmActionAddPayment}
                </Button>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
