'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';

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

export default function PayByTokenPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token;
  const { locale } = useLocale();

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
      payDeposit: 'Pay deposit',
      payTwenty: 'Pay 20%',
      payThirty: 'Pay 30%',
      payRemaining: 'Pay remaining',
      fullyPaid: 'This invoice is fully paid.',
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
      payDeposit: "Payer l'acompte",
      payTwenty: 'Payer 20%',
      payThirty: 'Payer 30%',
      payRemaining: 'Payer le reste',
      fullyPaid: 'Cette facture est entièrement réglée.',
      redirecting: 'Redirection...',
      createPaymentFailed: 'Impossible de créer le lien de paiement',
    },
  }[locale];

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [data, setData] = useState<PaymentLinkData | null>(null);

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

  const quick20 = Math.min(data.remainingAmount, Math.round(data.totalAmount * 0.2));
  const quick30 = Math.min(data.remainingAmount, Math.round(data.totalAmount * 0.3));
  const displayInvoiceNumber = formatInvoiceDisplayNumber(locale, data.invoiceNumber);

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-semibold">{t.invoiceLabel} {displayInvoiceNumber}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t.secureHosted}</p>

      <section className="mt-5 rounded-xl border border-border/70 bg-card p-4">
        <p className="text-sm">
          {t.total}: <PriceDisplay cents={data.totalAmount} locale={priceLocale} className="font-semibold" />
          {' · '}
          {t.paid}: <PriceDisplay cents={data.totalPaid} locale={priceLocale} className="font-medium" />
          {' · '}
          {t.remaining}: <PriceDisplay cents={data.remainingAmount} locale={priceLocale} className="font-medium" />
        </p>

        {data.canPay && token ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {data.depositAmount > 0 && data.totalPaid === 0 && data.depositAmount <= data.remainingAmount ? (
              <TokenPayButton token={token} type="deposit" amountCents={data.depositAmount} label={t.payDeposit} loadingLabel={t.redirecting} errorMessage={t.createPaymentFailed} />
            ) : null}

            {quick20 > 0 && quick20 < data.remainingAmount ? (
              <TokenPayButton token={token} type="full" amountCents={quick20} label={t.payTwenty} loadingLabel={t.redirecting} errorMessage={t.createPaymentFailed} />
            ) : null}
            {quick30 > 0 && quick30 < data.remainingAmount ? (
              <TokenPayButton token={token} type="full" amountCents={quick30} label={t.payThirty} loadingLabel={t.redirecting} errorMessage={t.createPaymentFailed} />
            ) : null}
            <TokenPayButton token={token} type="full" amountCents={data.remainingAmount} label={t.payRemaining} loadingLabel={t.redirecting} errorMessage={t.createPaymentFailed} />
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
  label,
  loadingLabel,
  errorMessage,
}: {
  token: string;
  type: 'full' | 'deposit';
  amountCents: number;
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
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-60"
    >
      {loading ? loadingLabel : label}
    </button>
  );
}
