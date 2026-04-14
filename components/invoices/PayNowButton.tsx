'use client';

import { useState } from 'react';

import { toast } from 'sonner';

import { Button } from '@/components/ui/button';

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

      toast.error(data?.message || 'Could not create payment link');
      setLoading(false);
    } catch {
      toast.error('Could not create payment link');
      setLoading(false);
    }
  }

  return (
    <Button type="button" onClick={handlePay} disabled={loading} className={className}>
      {loading ? 'Redirecting to payment...' : label}
    </Button>
  );
}
