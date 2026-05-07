'use client';

import { useState } from 'react';

import { toast } from 'sonner';

import { useLocale } from '@/components/providers/locale-provider';
import { Button } from '@/components/ui/button';
import { translate } from '@/lib/i18n/messages';

interface PayNowButtonProps {
  invoiceId: string;
  type: 'full' | 'deposit';
  label: string;
  amountCents?: number;
  className?: string;
  onRedirecting?: () => void;
}

export function PayNowButton({
  invoiceId,
  type,
  label,
  amountCents,
  className,
  onRedirecting,
}: PayNowButtonProps) {
  const { locale } = useLocale();
  const [loading, setLoading] = useState(false);

  async function handlePay() {
    try {
      setLoading(true);
      onRedirecting?.();

      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId,
          type,
          locale,
          ...(typeof amountCents === 'number' ? { amount: Math.max(0, Math.round(amountCents)) } : {}),
          idempotencyKey:
            typeof window !== 'undefined' && window.crypto?.randomUUID
              ? window.crypto.randomUUID()
              : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        }),
      });

      const data = (await res.json().catch(() => null)) as { checkoutUrl?: string; message?: string } | null;
      if (data?.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }

      toast.error(data?.message || translate(locale, 'payment.linkFailed'));
      setLoading(false);
    } catch {
      toast.error(translate(locale, 'payment.linkFailed'));
      setLoading(false);
    }
  }

  return (
    <Button type="button" onClick={handlePay} disabled={loading} className={className}>
      {loading ? translate(locale, 'payment.redirecting') : label}
    </Button>
  );
}
