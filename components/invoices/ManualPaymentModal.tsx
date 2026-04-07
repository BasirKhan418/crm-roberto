'use client';

import { useMemo, useState } from 'react';

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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { type ManualPaymentMethodOption } from '@/lib/payments';

export type ManualPaymentType = 'full' | 'partial';

interface ManualPaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading?: boolean;
  locale: 'en' | 'fr';
  totalAmount: number;
  totalPaidAmount: number;
  remainingAmount: number;
  onConfirm: (payload: { amount: number; paymentType: ManualPaymentType; method: string; customMethod?: string }) => Promise<void>;
}

export default function ManualPaymentModal({
  open,
  onOpenChange,
  loading = false,
  locale,
  totalAmount,
  totalPaidAmount,
  remainingAmount,
  onConfirm,
}: ManualPaymentModalProps) {
  const t = {
    en: {
      title: 'Record payment',
      description: 'Capture the received amount and how the client paid it.',
      paymentType: 'Payment type',
      typeFull: 'Full payment',
      typePartial: 'Partial payment',
      amountPaid: 'Amount paid (EUR)',
      amountHint: 'Enter the amount to record for this payment.',
      paymentMethod: 'Payment method',
      methodCash: 'Cash',
      methodBank: 'Bank transfer',
      methodCard: 'Card',
      methodCheck: 'Check',
      methodCustom: 'Custom method',
      customMethod: 'Custom payment method',
      customMethodPlaceholder: 'Wire transfer Luxembourg',
      customMethodHint: 'Use the exact label you want to see in payment history and PDFs.',
      cancel: 'Cancel',
      confirm: 'Save payment',
      saving: 'Saving...',
      amountPlaceholder: '250.00',
      summaryTotal: 'Total invoice amount',
      summaryPaid: 'Total paid',
      summaryRemaining: 'Remaining amount',
    },
    fr: {
      title: 'Enregistrer un paiement',
      description: 'Indiquez le montant recu et la methode de paiement du client.',
      paymentType: 'Type de paiement',
      typeFull: 'Paiement complet',
      typePartial: 'Paiement partiel',
      amountPaid: 'Montant paye (EUR)',
      amountHint: 'Saisissez le montant a enregistrer pour ce paiement.',
      paymentMethod: 'Methode de paiement',
      methodCash: 'Especes',
      methodBank: 'Virement bancaire',
      methodCard: 'Carte',
      methodCheck: 'Cheque',
      methodCustom: 'Methode personnalisee',
      customMethod: 'Nom de la methode personnalisee',
      customMethodPlaceholder: 'Virement Luxembourg',
      customMethodHint: 'Ce libelle sera affiche tel quel dans l historique et les PDF.',
      cancel: 'Annuler',
      confirm: 'Enregistrer le paiement',
      saving: 'Enregistrement...',
      amountPlaceholder: '250,00',
      summaryTotal: 'Montant total de la facture',
      summaryPaid: 'Total paye',
      summaryRemaining: 'Montant restant',
    },
  }[locale];

  const [paymentType, setPaymentType] = useState<ManualPaymentType>('partial');
  const [amountInput, setAmountInput] = useState('');
  const [method, setMethod] = useState<ManualPaymentMethodOption>('bank_transfer');
  const [customMethod, setCustomMethod] = useState('');

  function resetForm() {
    setPaymentType('partial');
    setAmountInput('');
    setMethod('bank_transfer');
    setCustomMethod('');
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      resetForm();
    }

    onOpenChange(nextOpen);
  }

  const formatter = useMemo(
    () =>
      new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', {
        style: 'currency',
        currency: 'EUR',
      }),
    [locale]
  );

  function computePayload(): { amount: number; paymentType: ManualPaymentType; method: string; customMethod?: string } {
    if (paymentType === 'full') {
      return {
        amount: remainingAmount,
        paymentType: 'full',
        method: method === 'custom' ? 'other' : method,
        ...(method === 'custom' ? { customMethod: customMethod.trim() } : {}),
      };
    }

    const parsed = Number(amountInput.replace(',', '.'));
    const amount = Number.isFinite(parsed)
      ? Math.max(0, Math.min(remainingAmount, Math.round(parsed * 100)))
      : 0;

    return {
      amount,
      paymentType: 'partial',
      method: method === 'custom' ? 'other' : method,
      ...(method === 'custom' ? { customMethod: customMethod.trim() } : {}),
    };
  }

  const preview = computePayload();
  const requiresCustomMethod = method === 'custom';
  const hasValidCustomMethod = !requiresCustomMethod || customMethod.trim().length > 0;
  const canSubmit = !loading && remainingAmount > 0 && preview.amount > 0 && hasValidCustomMethod;

  async function handleSubmit() {
    if (!canSubmit) {
      return;
    }

    await onConfirm(preview);
  }

  const paymentTypeSelectId = 'manual-payment-type';
  const paymentAmountInputId = 'manual-payment-amount';
  const paymentMethodSelectId = 'manual-payment-method';
  const customPaymentMethodInputId = 'manual-payment-custom-method';

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-140">
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription>{t.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-md border border-border/70 bg-muted/20 p-3 text-sm">
            <p>{t.summaryTotal}: <span className="font-medium">{formatter.format(totalAmount / 100)}</span></p>
            <p>{t.summaryPaid}: <span className="font-medium">{formatter.format(totalPaidAmount / 100)}</span></p>
            <p>{t.summaryRemaining}: <span className="font-semibold">{formatter.format(remainingAmount / 100)}</span></p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={paymentTypeSelectId}>{t.paymentType}</Label>
            <Select
              value={paymentType}
              onValueChange={(value) => {
                const nextType = value as ManualPaymentType;
                setPaymentType(nextType);
                if (nextType === 'full') {
                  setAmountInput('');
                }
              }}
            >
              <SelectTrigger id={paymentTypeSelectId} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full">{t.typeFull}</SelectItem>
                <SelectItem value="partial">{t.typePartial}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={paymentAmountInputId}>{t.amountPaid}</Label>
            <Input
              id={paymentAmountInputId}
              value={paymentType === 'full' ? (remainingAmount / 100).toFixed(2) : amountInput}
              onChange={(event) => setAmountInput(event.target.value)}
              placeholder={t.amountPlaceholder}
              inputMode="decimal"
              disabled={paymentType === 'full'}
            />
            <p className="text-xs text-muted-foreground">{t.amountHint}</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={paymentMethodSelectId}>{t.paymentMethod}</Label>
            <Select value={method} onValueChange={(value) => setMethod(value as ManualPaymentMethodOption)}>
              <SelectTrigger id={paymentMethodSelectId} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">{t.methodCash}</SelectItem>
                <SelectItem value="bank_transfer">{t.methodBank}</SelectItem>
                <SelectItem value="card">{t.methodCard}</SelectItem>
                <SelectItem value="check">{t.methodCheck}</SelectItem>
                <SelectItem value="custom">{t.methodCustom}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {requiresCustomMethod ? (
            <div className="space-y-1.5">
              <Label htmlFor={customPaymentMethodInputId}>{t.customMethod}</Label>
              <Input
                id={customPaymentMethodInputId}
                value={customMethod}
                onChange={(event) => setCustomMethod(event.target.value)}
                placeholder={t.customMethodPlaceholder}
                maxLength={80}
              />
              <p className="text-xs text-muted-foreground">{t.customMethodHint}</p>
            </div>
          ) : null}

          <p className="text-sm text-muted-foreground">
            {t.summaryRemaining}: <span className="font-semibold text-foreground">{formatter.format(Math.max(0, remainingAmount - preview.amount) / 100)}</span>
          </p>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={loading}>
            {t.cancel}
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={!canSubmit}>
            {loading ? t.saving : t.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
