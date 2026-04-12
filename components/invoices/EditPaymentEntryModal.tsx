'use client';

import { useMemo, useState } from 'react';

import { CalendarDaysIcon, WalletCardsIcon } from 'lucide-react';

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

interface EditPaymentEntryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading?: boolean;
  locale: 'en' | 'fr';
  amount: number;
  method: string;
  paidAt?: string | null;
  remainingBaseAmount: number;
  onConfirm: (payload: { amount: number; method: string; customMethod?: string; paidAt: string }) => Promise<void>;
}

function normalizeEditableMethod(method: string): 'cash' | 'bank_transfer' | 'card' | 'check' | 'other' {
  if (method === 'cash' || method === 'bank_transfer' || method === 'card' || method === 'check') {
    return method;
  }

  return 'other';
}

function formatDateInput(dateValue?: string | null): string {
  if (!dateValue) {
    return '';
  }

  const parsed = new Date(dateValue);
  if (!Number.isFinite(parsed.getTime())) {
    return '';
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function EditPaymentEntryModal({
  open,
  onOpenChange,
  loading = false,
  locale,
  amount,
  method,
  paidAt,
  remainingBaseAmount,
  onConfirm,
}: EditPaymentEntryModalProps) {
  const t = {
    en: {
      title: 'Correct payment entry',
      description: 'Correct this payment record details.',
      auditNotice: 'For security and compliance, every correction is audit logged with before/after values, editor identity, and timestamp.',
      amount: 'Payment amount (EUR)',
      amountHint: 'Only this payment record is changed. Invoice amount remains locked.',
      paymentMethod: 'Payment method',
      methodCash: 'Cash',
      methodBank: 'Bank transfer',
      methodCard: 'Card',
      methodCheck: 'Check',
      methodCustom: 'Custom method',
      customMethod: 'Custom payment method',
      customMethodPlaceholder: 'Wire transfer Luxembourg',
      paymentDate: 'Payment date',
      paymentDateHint: 'This date is shown in history and PDFs.',
      cancel: 'Cancel',
      confirm: 'Save correction',
      saving: 'Saving...',
      amountPlaceholder: '250.00',
      remainingAfter: 'Remaining after correction',
    },
    fr: {
      title: 'Corriger une ligne de paiement',
      description: 'Corrigez les details de ce paiement.',
      auditNotice: 'Pour la securite et la conformite, chaque correction est journalisee avec les valeurs avant/apres, l auteur et l horodatage.',
      amount: 'Montant du paiement (EUR)',
      amountHint: 'Seul cet enregistrement est modifie. Le montant de la facture reste verrouille.',
      paymentMethod: 'Methode de paiement',
      methodCash: 'Especes',
      methodBank: 'Virement bancaire',
      methodCard: 'Carte',
      methodCheck: 'Cheque',
      methodCustom: 'Methode personnalisee',
      customMethod: 'Nom de la methode personnalisee',
      customMethodPlaceholder: 'Virement Luxembourg',
      paymentDate: 'Date du paiement',
      paymentDateHint: 'Cette date apparait dans l historique et les PDF.',
      cancel: 'Annuler',
      confirm: 'Enregistrer la correction',
      saving: 'Enregistrement...',
      amountPlaceholder: '250,00',
      remainingAfter: 'Reste apres correction',
    },
  }[locale];

  const [amountInput, setAmountInput] = useState((amount / 100).toFixed(2));
  const [selectedMethod, setSelectedMethod] = useState<'cash' | 'bank_transfer' | 'card' | 'check' | 'other'>(
    normalizeEditableMethod(method)
  );
  const [customMethod, setCustomMethod] = useState(normalizeEditableMethod(method) === 'other' ? method : '');
  const [paidAtInput, setPaidAtInput] = useState(formatDateInput(paidAt));

  const formatter = useMemo(
    () =>
      new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', {
        style: 'currency',
        currency: 'EUR',
      }),
    [locale]
  );

  const requiresCustomMethod = !['cash', 'bank_transfer', 'card', 'check'].includes(selectedMethod);
  const normalizedMethod = requiresCustomMethod ? 'other' : selectedMethod;
  const parsedAmount = Number(amountInput.replace(',', '.'));
  const nextAmount = Number.isFinite(parsedAmount) ? Math.round(parsedAmount * 100) : 0;
  const nextPaidAt = paidAtInput ? new Date(`${paidAtInput}T12:00:00.000Z`) : null;
  const isValidDate = Boolean(nextPaidAt && Number.isFinite(nextPaidAt.getTime()));
  const canSubmit = nextAmount > 0 && isValidDate && (!requiresCustomMethod || customMethod.trim().length > 0) && !loading;

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setAmountInput((amount / 100).toFixed(2));
      const normalizedMethod = normalizeEditableMethod(method);
      setSelectedMethod(normalizedMethod);
      setCustomMethod(normalizedMethod === 'other' ? method : '');
      setPaidAtInput(formatDateInput(paidAt));
    }

    onOpenChange(nextOpen);
  }

  async function submit() {
    if (!canSubmit || !nextPaidAt) {
      return;
    }

    await onConfirm({
      amount: nextAmount,
      method: normalizedMethod,
      ...(requiresCustomMethod ? { customMethod: customMethod.trim() } : {}),
      paidAt: nextPaidAt.toISOString(),
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-170">
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription>{t.description}</DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-blue-200/70 bg-blue-50/70 px-3 py-2 text-xs text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-200">
          {t.auditNotice}
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-border/70 bg-linear-to-r from-secondary/35 via-background to-emerald-50/40 p-3 text-sm dark:from-secondary/20 dark:to-emerald-950/20">
            <p className="font-medium">{t.remainingAfter}</p>
            <p className="mt-1 text-base font-semibold text-foreground">{formatter.format(Math.max(0, remainingBaseAmount - nextAmount) / 100)}</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="payment-edit-amount">{t.amount}</Label>
            <Input
              id="payment-edit-amount"
              value={amountInput}
              onChange={(event) => setAmountInput(event.target.value)}
              placeholder={t.amountPlaceholder}
              inputMode="decimal"
            />
            <p className="text-xs text-muted-foreground">{t.amountHint}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="payment-edit-method" className="inline-flex items-center gap-1.5">
                <WalletCardsIcon className="size-3.5 text-muted-foreground" />
                {t.paymentMethod}
              </Label>
              <Select value={selectedMethod} onValueChange={(value) => setSelectedMethod(value as 'cash' | 'bank_transfer' | 'card' | 'check' | 'other')}>
                <SelectTrigger id="payment-edit-method" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">{t.methodCash}</SelectItem>
                  <SelectItem value="bank_transfer">{t.methodBank}</SelectItem>
                  <SelectItem value="card">{t.methodCard}</SelectItem>
                  <SelectItem value="check">{t.methodCheck}</SelectItem>
                  <SelectItem value="other">{t.methodCustom}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="payment-edit-date" className="inline-flex items-center gap-1.5">
                <CalendarDaysIcon className="size-3.5 text-muted-foreground" />
                {t.paymentDate}
              </Label>
              <Input
                id="payment-edit-date"
                type="date"
                value={paidAtInput}
                onChange={(event) => setPaidAtInput(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">{t.paymentDateHint}</p>
            </div>
          </div>

          {requiresCustomMethod ? (
            <div className="space-y-1.5">
              <Label htmlFor="payment-edit-custom-method">{t.customMethod}</Label>
              <Input
                id="payment-edit-custom-method"
                value={customMethod}
                onChange={(event) => setCustomMethod(event.target.value)}
                placeholder={t.customMethodPlaceholder}
                maxLength={80}
              />
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={loading}>
            {t.cancel}
          </Button>
          <Button type="button" onClick={submit} disabled={!canSubmit}>
            {loading ? t.saving : t.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
