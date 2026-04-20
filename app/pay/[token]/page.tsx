'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useSearchParams } from 'next/navigation';

import { useLocale } from '@/components/providers/locale-provider';
import { PriceDisplay } from '@/components/ui/PriceDisplay';
import { formatInvoiceDisplayNumber } from '@/lib/i18n/messages';

interface PaymentLinkData {
  invoiceId: string;
  invoiceNumber: string;
  status?: string;
  totalAmount: number;
  depositAmount: number;
  totalPaid: number;
  remainingAmount: number;
  canPay: boolean;
}

type PaymentChoice = 'full' | 'partial';

function parseEurosToCents(value: string): number | null {
  const normalized = value.replace(',', '.').trim();
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.round(parsed * 100);
}

function centsToEurosInput(cents: number): string {
  return (Math.max(0, cents) / 100).toFixed(2);
}

export default function PayByTokenPage() {
  const params = useParams<{ token: string }>();
  const searchParams = useSearchParams();
  const token = params?.token;
  const { locale } = useLocale();
  const status = searchParams.get('status');

  const t = {
    en: {
      invalidLink: 'Invalid payment link',
      loading: 'Loading payment page...',
      pageTitle: 'Payment link',
      invoiceLabel: 'Invoice',
      secureHosted: 'Secure payment hosted by Stripe.',
      total: 'Total',
      paid: 'Paid',
      remaining: 'Remaining',
      paymentType: 'Payment type',
      paymentTypeFull: 'Full payment',
      paymentTypePartial: 'Partial payment',
      amountPaid: 'Amount to pay (EUR)',
      amountHint: 'Enter how much you want to pay now.',
      amountInvalid: 'Enter a valid amount greater than 0.',
      amountTooHigh: 'Amount cannot exceed remaining balance.',
      partialMustBeLess: 'For full settlement, choose Full payment.',
      remainingAfter: 'Remaining after this payment',
      modeOnline: 'Mode: Online (Stripe)',
      payNow: 'Pay with Stripe',
      fullyPaid: 'This invoice is fully paid.',
      paymentSuccess: 'Payment started successfully. Confirmation may take a few seconds.',
      paymentCancelled: 'Payment was cancelled. You can try again.',
      redirecting: 'Redirecting...',
      createPaymentFailed: 'Could not create payment link',
    },
    fr: {
      invalidLink: 'Lien de paiement invalide',
      loading: 'Chargement de la page de paiement...',
      pageTitle: 'Lien de paiement',
      invoiceLabel: 'Facture',
      secureHosted: 'Paiement sécurisé hébergé par Stripe.',
      total: 'Total',
      paid: 'Payé',
      remaining: 'Reste',
      paymentType: 'Type de paiement',
      paymentTypeFull: 'Paiement complet',
      paymentTypePartial: 'Paiement partiel',
      amountPaid: 'Montant a payer (EUR)',
      amountHint: 'Entrez le montant a payer maintenant.',
      amountInvalid: 'Entrez un montant valide superieur a 0.',
      amountTooHigh: 'Le montant ne peut pas depasser le reste.',
      partialMustBeLess: 'Pour solder la facture, choisissez Paiement complet.',
      remainingAfter: 'Reste apres ce paiement',
      modeOnline: 'Mode : En ligne (Stripe)',
      payNow: 'Payer avec Stripe',
      fullyPaid: 'Cette facture est entièrement réglée.',
      paymentSuccess: 'Paiement lance avec succes. La confirmation peut prendre quelques secondes.',
      paymentCancelled: 'Paiement annule. Vous pouvez reessayer.',
      redirecting: 'Redirection...',
      createPaymentFailed: 'Impossible de créer le lien de paiement',
    },
  }[locale];

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [data, setData] = useState<PaymentLinkData | null>(null);
  const [paymentType, setPaymentType] = useState<PaymentChoice>('full');
  const [amountInput, setAmountInput] = useState('');

  useEffect(() => {
    if (!data) {
      return;
    }

    setAmountInput(centsToEurosInput(data.remainingAmount));
    setPaymentType('full');
  }, [data]);

  useEffect(() => {
    if (!token) {
      setMessage(t.invalidLink);
      setLoading(false);
      return;
    }

    const run = async () => {
      try {
        const response = await fetch(`/api/pay/${token}`, { cache: 'no-store' });
        const payload = (await response.json().catch(() => null)) as
          | { success?: boolean; data?: PaymentLinkData; message?: string }
          | null;

        if (!response.ok || !payload?.success || !payload.data) {
          setMessage(payload?.message || t.invalidLink);
          setData(null);
          return;
        }

        setData(payload.data);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [t.invalidLink, token]);

  const priceLocale = useMemo(() => (locale === 'fr' ? 'fr-FR' : 'en-GB'), [locale]);

  const selectedAmountCents = useMemo(() => {
    if (!data) {
      return 0;
    }

    if (paymentType === 'full') {
      return data.remainingAmount;
    }

    const parsed = parseEurosToCents(amountInput);
    return parsed ?? 0;
  }, [amountInput, data, paymentType]);

  const amountError = useMemo(() => {
    if (!data || !data.canPay) {
      return null;
    }

    if (paymentType === 'full') {
      return null;
    }

    const parsed = parseEurosToCents(amountInput);
    if (parsed === null || parsed <= 0) {
      return t.amountInvalid;
    }

    if (parsed > data.remainingAmount) {
      return t.amountTooHigh;
    }

    if (parsed >= data.remainingAmount) {
      return t.partialMustBeLess;
    }

    return null;
  }, [amountInput, data, paymentType, t.amountInvalid, t.amountTooHigh, t.partialMustBeLess]);

  const remainingAfterPayment = useMemo(() => {
    if (!data) {
      return 0;
    }

    return Math.max(0, data.remainingAmount - selectedAmountCents);
  }, [data, selectedAmountCents]);

  if (loading) {
    return <main className="mx-auto max-w-2xl p-6 text-sm text-muted-foreground">{t.loading}</main>;
  }

  if (!data) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <h1 className="text-xl font-semibold">{t.pageTitle}</h1>
        <p className="mt-2 text-sm text-destructive">{message || t.invalidLink}</p>
      </main>
    );
  }

  const displayInvoiceNumber = formatInvoiceDisplayNumber(locale, data.invoiceNumber);
  const canSubmit = data.canPay && selectedAmountCents > 0 && !amountError;

  const statusBanner =
    status === 'success'
      ? { text: t.paymentSuccess, className: 'border-emerald-200 bg-emerald-50 text-emerald-700' }
      : status === 'cancelled'
        ? { text: t.paymentCancelled, className: 'border-amber-200 bg-amber-50 text-amber-700' }
        : null;

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-semibold">{t.invoiceLabel} {displayInvoiceNumber}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t.secureHosted}</p>

      {statusBanner ? <p className={`mt-4 rounded-lg border px-3 py-2 text-sm ${statusBanner.className}`}>{statusBanner.text}</p> : null}

      <section className="mt-5 rounded-xl border border-border/70 bg-card p-4">
        <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-sm">
          <p>
            {t.total}: <PriceDisplay cents={data.totalAmount} locale={priceLocale} className="font-semibold" />
          </p>
          <p>
            {t.paid}: <PriceDisplay cents={data.totalPaid} locale={priceLocale} className="font-semibold" />
          </p>
          <p>
            {t.remaining}: <PriceDisplay cents={data.remainingAmount} locale={priceLocale} className="font-semibold" />
          </p>
        </div>

        {data.canPay && token ? (
          <div className="mt-4 space-y-4">
            <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-700">{t.modeOnline}</div>

            <div className="space-y-1">
              <label htmlFor="payment-type" className="text-sm font-medium">{t.paymentType}</label>
              <select
                id="payment-type"
                value={paymentType}
                onChange={(event) => {
                  const nextType = event.target.value === 'partial' ? 'partial' : 'full';
                  setPaymentType(nextType);
                  if (nextType === 'full') {
                    setAmountInput(centsToEurosInput(data.remainingAmount));
                  } else if (amountInput === '' || parseEurosToCents(amountInput) === data.remainingAmount) {
                    setAmountInput('');
                  }
                }}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="full">{t.paymentTypeFull}</option>
                <option value="partial">{t.paymentTypePartial}</option>
              </select>
            </div>

            <div className="space-y-1">
              <label htmlFor="amount-input" className="text-sm font-medium">{t.amountPaid}</label>
              <input
                id="amount-input"
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                max={centsToEurosInput(data.remainingAmount)}
                value={paymentType === 'full' ? centsToEurosInput(data.remainingAmount) : amountInput}
                onChange={(event) => setAmountInput(event.target.value)}
                disabled={paymentType === 'full'}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
              />
              <p className="text-xs text-muted-foreground">{t.amountHint}</p>
              {amountError ? <p className="text-xs text-destructive">{amountError}</p> : null}
            </div>

            <p className="text-sm text-muted-foreground">
              {t.remainingAfter}:{' '}
              <PriceDisplay cents={remainingAfterPayment} locale={priceLocale} className="font-semibold text-foreground" />
            </p>

            <TokenPayButton
              token={token}
              type={paymentType}
              amountCents={selectedAmountCents}
              disabled={!canSubmit}
              label={t.payNow}
              loadingLabel={t.redirecting}
              errorMessage={t.createPaymentFailed}
            />
          </div>
        ) : (
          <p className="mt-4 text-sm text-emerald-700">{t.fullyPaid}</p>
        )}
      </section>
    </main>
  );
}

function TokenPayButton({
  token,
  type,
  amountCents,
  disabled,
  label,
  loadingLabel,
  errorMessage,
}: {
  token: string;
  type: 'full' | 'partial';
  amountCents: number;
  disabled: boolean;
  label: string;
  loadingLabel: string;
  errorMessage: string;
}) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    try {
      setLoading(true);
      const response = await fetch(`/api/pay/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          amount: amountCents,
          idempotencyKey: `token-${token}-${type}-${amountCents}`,
        }),
      });
      const payload = (await response.json().catch(() => null)) as { checkoutUrl?: string; message?: string } | null;
      if (payload?.checkoutUrl) {
        window.location.href = payload.checkoutUrl;
        return;
      }
      alert(payload?.message || errorMessage);
    } catch {
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading || disabled}
      className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-60"
    >
      {loading ? loadingLabel : label}
    </button>
  );
}
