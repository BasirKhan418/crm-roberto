'use client';

import { useEffect, useMemo, useState } from 'react';

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

export type ManualPaymentType = 'full' | 'deposit' | 'remaining_balance';

type PaymentMode = 'full' | 'deposit' | 'percentage' | 'custom';

interface ManualPaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading?: boolean;
  locale: 'en' | 'fr';
  totalAmount: number;
  totalPaidAmount: number;
  remainingAmount: number;
  depositAmount: number;
  onConfirm: (payload: { amount: number; paymentType: ManualPaymentType }) => Promise<void>;
}

export default function ManualPaymentModal({
  open,
  onOpenChange,
  loading = false,
  locale,
  totalAmount,
  totalPaidAmount,
  remainingAmount,
  depositAmount,
  onConfirm,
}: ManualPaymentModalProps) {
  const t = {
    en: {
      title: 'Record manual payment',
      description: 'Choose how much was paid and how to classify this payment.',
      mode: 'Payment option',
      modeFull: 'Full remaining amount',
      modeDeposit: 'Deposit paid',
      modePercentage: 'Percentage',
      modeCustom: 'Custom amount',
      percentage: 'Percentage of invoice total',
      customAmount: 'Custom paid amount (EUR)',
      classify: 'Classify as',
      classifyDeposit: 'Deposit paid',
      classifyBalance: 'Initial / balance payment',
      cancel: 'Cancel',
      confirm: 'Save payment',
      saving: 'Saving...',
      summaryTotal: 'Total',
      summaryPaid: 'Already paid',
      summaryRemaining: 'Remaining',
    },
    fr: {
      title: 'Enregistrer un paiement manuel',
      description: 'Choisissez le montant payé et la classification de ce paiement.',
      mode: 'Option de paiement',
      modeFull: 'Solde total restant',
      modeDeposit: 'Acompte payé',
      modePercentage: 'Pourcentage',
      modeCustom: 'Montant personnalisé',
      percentage: 'Pourcentage du total facture',
      customAmount: 'Montant payé personnalisé (EUR)',
      classify: 'Classer comme',
      classifyDeposit: 'Acompte payé',
      classifyBalance: 'Paiement initial / solde',
      cancel: 'Annuler',
      confirm: 'Enregistrer',
      saving: 'Enregistrement...',
      summaryTotal: 'Total',
      summaryPaid: 'Déjà payé',
      summaryRemaining: 'Reste',
    },
  }[locale];

  const [mode, setMode] = useState<PaymentMode>('full');
  const [percentage, setPercentage] = useState('30');
  const [customAmount, setCustomAmount] = useState('');
  const [customType, setCustomType] = useState<'deposit' | 'remaining_balance'>('remaining_balance');

  useEffect(() => {
    if (!open) {
      setMode('full');
      setPercentage('30');
      setCustomAmount('');
      setCustomType('remaining_balance');
    }
  }, [open]);

  const formatter = useMemo(
    () =>
      new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', {
        style: 'currency',
        currency: 'EUR',
      }),
    [locale]
  );

  const depositOutstanding = Math.max(0, depositAmount - totalPaidAmount);

  function computePayload(): { amount: number; paymentType: ManualPaymentType } {
    if (mode === 'full') {
      return { amount: remainingAmount, paymentType: 'full' };
    }

    if (mode === 'deposit') {
      const amount = Math.max(0, Math.min(remainingAmount, depositOutstanding > 0 ? depositOutstanding : depositAmount));
      return { amount, paymentType: 'deposit' };
    }

    if (mode === 'percentage') {
      const parsed = Number(percentage.replace(',', '.'));
      const pct = Number.isFinite(parsed) ? Math.max(0, Math.min(100, parsed)) : 0;
      const amount = Math.max(0, Math.min(remainingAmount, Math.round((totalAmount * pct) / 100)));
      return { amount, paymentType: 'remaining_balance' };
    }

    const parsed = Number(customAmount.replace(',', '.'));
    const amount = Number.isFinite(parsed)
      ? Math.max(0, Math.min(remainingAmount, Math.round(parsed * 100)))
      : 0;

    return {
      amount,
      paymentType: customType,
    };
  }

  const preview = computePayload();
  const canSubmit = !loading && remainingAmount > 0 && preview.amount > 0;

  async function handleSubmit() {
    if (!canSubmit) {
      return;
    }

    await onConfirm(preview);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
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
            <Label>{t.mode}</Label>
            <Select value={mode} onValueChange={(value) => setMode(value as PaymentMode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full">{t.modeFull}</SelectItem>
                <SelectItem value="deposit">{t.modeDeposit}</SelectItem>
                <SelectItem value="percentage">{t.modePercentage}</SelectItem>
                <SelectItem value="custom">{t.modeCustom}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {mode === 'percentage' ? (
            <div className="space-y-1.5">
              <Label>{t.percentage}</Label>
              <Input value={percentage} onChange={(event) => setPercentage(event.target.value)} placeholder="30" />
            </div>
          ) : null}

          {mode === 'custom' ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>{t.customAmount}</Label>
                <Input value={customAmount} onChange={(event) => setCustomAmount(event.target.value)} placeholder="250.00" />
              </div>
              <div className="space-y-1.5">
                <Label>{t.classify}</Label>
                <Select value={customType} onValueChange={(value) => setCustomType(value as 'deposit' | 'remaining_balance')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="deposit">{t.classifyDeposit}</SelectItem>
                    <SelectItem value="remaining_balance">{t.classifyBalance}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}

          <p className="text-sm text-muted-foreground">
            {t.summaryRemaining}: <span className="font-semibold text-foreground">{formatter.format(preview.amount / 100)}</span>
          </p>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
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
