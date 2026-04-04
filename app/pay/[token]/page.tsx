'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';

import { PriceDisplay } from '@/components/ui/PriceDisplay';

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

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [data, setData] = useState<PaymentLinkData | null>(null);

  useEffect(() => {
    if (!token) {
      setMessage('Invalid payment link');
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
          setMessage(payload?.message || 'Invalid payment link');
          setData(null);
          return;
        }

        setData(payload.data);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [token]);

  const locale = useMemo(() => 'en-GB', []);

  if (loading) {
    return <main className="mx-auto max-w-2xl p-6 text-sm text-muted-foreground">Loading payment page...</main>;
  }

  if (!data) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <h1 className="text-xl font-semibold">Payment link</h1>
        <p className="mt-2 text-sm text-destructive">{message || 'Invalid payment link'}</p>
      </main>
    );
  }

  const quick20 = Math.min(data.remainingAmount, Math.round(data.totalAmount * 0.2));
  const quick30 = Math.min(data.remainingAmount, Math.round(data.totalAmount * 0.3));

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-semibold">Invoice {data.invoiceNumber}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Secure payment hosted by Stripe.</p>

      <section className="mt-5 rounded-xl border border-border/70 bg-card p-4">
        <p className="text-sm">
          Total: <PriceDisplay cents={data.totalAmount} locale={locale} className="font-semibold" />
          {' · '}
          Paid: <PriceDisplay cents={data.totalPaid} locale={locale} className="font-medium" />
          {' · '}
          Remaining: <PriceDisplay cents={data.remainingAmount} locale={locale} className="font-medium" />
        </p>

        {data.canPay && token ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {data.depositAmount > 0 && data.totalPaid === 0 && data.depositAmount <= data.remainingAmount ? (
              <TokenPayButton token={token} type="deposit" amountCents={data.depositAmount} label="Pay deposit" />
            ) : null}

            {quick20 > 0 && quick20 < data.remainingAmount ? (
              <TokenPayButton token={token} type="full" amountCents={quick20} label="Pay 20%" />
            ) : null}
            {quick30 > 0 && quick30 < data.remainingAmount ? (
              <TokenPayButton token={token} type="full" amountCents={quick30} label="Pay 30%" />
            ) : null}
            <TokenPayButton token={token} type="full" amountCents={data.remainingAmount} label="Pay remaining" />
          </div>
        ) : (
          <p className="mt-4 text-sm text-emerald-700">This invoice is fully paid.</p>
        )}
      </section>
    </main>
  );
}

function TokenPayButton({ token, type, amountCents, label }: { token: string; type: 'full' | 'deposit'; amountCents: number; label: string }) {
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
      alert(payload?.message || 'Could not create payment link');
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
      {loading ? 'Redirecting...' : label}
    </button>
  );
}
