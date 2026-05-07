'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { ShieldCheck, Lock, Wallet, ReceiptText, CreditCard, ArrowLeft, Loader2 } from 'lucide-react';

import { useLocale } from '@/components/providers/locale-provider';
import { PriceDisplay } from '@/components/ui/PriceDisplay';
import { formatInvoiceDisplayNumber } from '@/lib/i18n/messages';

const Lottie = dynamic(() => import('lottie-react'), { ssr: false });

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

type ConfirmedPaymentData = PaymentLinkData;

type PaymentChoice = 'full' | 'partial';

function parseEurosToCents(value: string): number | null {
  const normalized = value.replace(',', '.').trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed * 100);
}

function centsToEurosInput(cents: number): string {
  return (Math.max(0, cents) / 100).toFixed(2);
}

export default function PayByTokenPage() {
  const params = useParams<{ token: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = params?.token;
  const { locale } = useLocale();
  const status = searchParams.get('status');

  const t = {
    en: {
      invalidLink: 'Invalid or expired payment link',
      invalidLinkDesc: 'The link you followed is no longer valid. Please contact the sender to receive a new one.',
      loading: 'Loading your payment…',
      pageTitle: 'Secure payment',
      invoiceLabel: 'Invoice',
      secureHosted: 'Payment securely processed by Stripe',
      total: 'Total',
      paid: 'Already paid',
      remaining: 'Amount due',
      paymentType: 'How much would you like to pay?',
      paymentTypeFull: 'Pay in full',
      paymentTypeFullDesc: 'Settle the remaining balance',
      paymentTypePartial: 'Pay a custom amount',
      paymentTypePartialDesc: 'Enter a partial amount below',
      amountPaid: 'Amount (EUR)',
      amountHint: 'Enter the amount you want to pay now.',
      amountInvalid: 'Enter a valid amount greater than 0.',
      amountTooHigh: 'Amount cannot exceed amount due.',
      partialMustBeLess: 'For full payment, choose "Pay in full".',
      remainingAfter: 'Balance after this payment',
      payNow: 'Pay securely',
      fullyPaid: 'Invoice fully paid',
      fullyPaidDesc: 'Thank you — there is nothing left to pay on this invoice.',
      paymentSuccess: 'Payment successful',
      paymentSuccessDesc: 'Thank you! Your payment is being confirmed. A receipt will be sent shortly.',
      paymentRecordedDesc: 'Your payment has been recorded. You can now close this tab.',
      paymentRecordedPartialDesc: 'Your payment has been recorded. There is still a remaining balance to pay.',
      closeTab: 'Close this tab',
      confirmingPayment: 'Confirming your payment…',
      remainingToPay: 'Remaining to pay',
      paymentCancelled: 'Payment cancelled',
      paymentCancelledDesc: "The payment wasn't completed. You can safely try again whenever you're ready.",
      redirecting: 'Redirecting to Stripe…',
      createPaymentFailed: 'Could not create payment link',
      tryAgain: 'Try again',
      backToPayment: 'Back to payment',
      poweredBy: 'Powered by',
    },
    fr: {
      invalidLink: 'Lien de paiement invalide ou expiré',
      invalidLinkDesc: "Ce lien n'est plus valide. Contactez l'expéditeur pour en recevoir un nouveau.",
      loading: 'Chargement du paiement…',
      pageTitle: 'Paiement sécurisé',
      invoiceLabel: 'Facture',
      secureHosted: 'Paiement sécurisé par Stripe',
      total: 'Total',
      paid: 'Déjà payé',
      remaining: 'Solde à régler',
      paymentType: 'Combien souhaitez-vous payer ?',
      paymentTypeFull: 'Paiement intégral',
      paymentTypeFullDesc: 'Régler le solde restant',
      paymentTypePartial: 'Montant personnalisé',
      paymentTypePartialDesc: 'Saisissez un montant partiel ci-dessous',
      amountPaid: 'Montant (EUR)',
      amountHint: 'Saisissez le montant à payer maintenant.',
      amountInvalid: 'Saisissez un montant valide supérieur à 0.',
      amountTooHigh: 'Le montant ne peut pas dépasser le solde dû.',
      partialMustBeLess: 'Pour solder la facture, choisissez « Paiement intégral ».',
      remainingAfter: 'Solde après ce paiement',
      payNow: 'Payer en toute sécurité',
      fullyPaid: 'Facture entièrement réglée',
      fullyPaidDesc: 'Merci — il ne reste rien à régler sur cette facture.',
      paymentSuccess: 'Paiement réussi',
      paymentSuccessDesc: 'Merci ! Votre paiement est en cours de confirmation. Un reçu vous sera envoyé sous peu.',
      paymentRecordedDesc: 'Votre paiement a été enregistré. Vous pouvez maintenant fermer cet onglet.',
      paymentRecordedPartialDesc: 'Votre paiement a été enregistré. Il reste encore un solde à régler.',
      closeTab: 'Fermer cet onglet',
      confirmingPayment: 'Confirmation de votre paiement…',
      remainingToPay: 'Solde restant à payer',
      paymentCancelled: 'Paiement annulé',
      paymentCancelledDesc: "Le paiement n'a pas été finalisé. Vous pouvez réessayer à tout moment.",
      redirecting: 'Redirection vers Stripe…',
      createPaymentFailed: 'Impossible de créer le lien de paiement',
      tryAgain: 'Réessayer',
      backToPayment: 'Retour au paiement',
      poweredBy: 'Propulsé par',
    },
  }[locale];

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [data, setData] = useState<PaymentLinkData | null>(null);
  const [paymentType, setPaymentType] = useState<PaymentChoice>('full');
  const [amountInput, setAmountInput] = useState('');
  const [hasMounted, setHasMounted] = useState(false);
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (!data) return;
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
    if (!data) return 0;
    if (paymentType === 'full') return data.remainingAmount;
    const parsed = parseEurosToCents(amountInput);
    return parsed ?? 0;
  }, [amountInput, data, paymentType]);

  const amountError = useMemo(() => {
    if (!data || !data.canPay) return null;
    if (paymentType === 'full') return null;
    const parsed = parseEurosToCents(amountInput);
    if (parsed === null || parsed <= 0) return t.amountInvalid;
    if (parsed > data.remainingAmount) return t.amountTooHigh;
    if (parsed >= data.remainingAmount) return t.partialMustBeLess;
    return null;
  }, [amountInput, data, paymentType, t.amountInvalid, t.amountTooHigh, t.partialMustBeLess]);

  const remainingAfterPayment = useMemo(() => {
    if (!data) return 0;
    return Math.max(0, data.remainingAmount - selectedAmountCents);
  }, [data, selectedAmountCents]);

  if (status && !hasMounted) {
    return (
      <main className="min-h-dvh flex flex-col items-center justify-center gap-4 bg-linear-to-b from-background via-background to-muted/40 px-6 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
        <p className="text-sm text-muted-foreground">
          {status === 'success' ? t.confirmingPayment : t.loading}
        </p>
      </main>
    );
  }

  if (status === 'success' && token && sessionId) {
    return (
      <PaymentSuccessStatus
        token={token}
        sessionId={sessionId}
        locale={locale}
        successTitle={t.paymentSuccess}
        errorTitle={t.paymentCancelled}
        confirmingLabel={t.confirmingPayment}
        successDescription={t.paymentRecordedDesc}
        partialSuccessDescription={t.paymentRecordedPartialDesc}
        errorDescription={t.paymentCancelledDesc}
        closeLabel={t.closeTab}
        retryLabel={t.tryAgain}
        backToPaymentLabel={t.backToPayment}
        remainingLabel={t.remainingToPay}
        fallbackError={t.createPaymentFailed}
        onRetry={() => router.replace(`/pay/${token}`)}
      />
    );
  }
  if (status === 'success') {
    return (
      <StatusScreen
        variant="failed"
        title={t.paymentCancelled}
        description={t.paymentCancelledDesc}
        primaryLabel={t.tryAgain}
        onPrimary={() => router.replace(`/pay/${token}`)}
      />
    );
  }
  if (status === 'cancelled' || status === 'failed') {
    return (
      <StatusScreen
        variant="failed"
        title={t.paymentCancelled}
        description={t.paymentCancelledDesc}
        primaryLabel={t.tryAgain}
        onPrimary={() => router.replace(`/pay/${token}`)}
      />
    );
  }

  if (loading) {
    return (
      <main className="min-h-dvh flex flex-col items-center justify-center gap-4 bg-linear-to-b from-background via-background to-muted/40 px-6 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
        <p className="text-sm text-muted-foreground">{t.loading}</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="min-h-dvh flex flex-col items-center justify-center gap-4 bg-linear-to-b from-background via-background to-muted/40 px-6 text-center">
        <div className="w-full max-w-sm rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
          <h1 className="text-lg font-semibold text-destructive">{t.invalidLink}</h1>
          <p className="mt-2 text-sm text-destructive/80">{message || t.invalidLinkDesc}</p>
        </div>
      </main>
    );
  }

  const displayInvoiceNumber = formatInvoiceDisplayNumber(locale, data.invoiceNumber);
  const canSubmit = data.canPay && selectedAmountCents > 0 && !amountError;

  return (
    <main className="min-h-dvh bg-linear-to-b from-background via-background to-muted/30">
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/80 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShieldCheck className="h-5 w-5" aria-hidden />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold">{t.pageTitle}</p>
              <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Lock className="h-3 w-3" aria-hidden /> {t.secureHosted}
              </p>
            </div>
          </div>
          <div className="hidden items-center text-xs font-medium text-muted-foreground sm:flex">
            <span>{`${t.poweredBy} Stripe`}</span>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-2xl px-4 py-5 pb-28 sm:px-6 sm:py-8 sm:pb-10">
        <section className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
          <div className="flex items-center gap-2 border-b border-border/60 bg-muted/30 px-4 py-3 sm:px-5">
            <ReceiptText className="h-4 w-4 text-muted-foreground" aria-hidden />
            <p className="text-sm font-medium">
              {t.invoiceLabel} <span className="text-muted-foreground">·</span>{' '}
              <span className="font-semibold">{displayInvoiceNumber}</span>
            </p>
          </div>

          <div className="px-4 py-4 sm:px-5 sm:py-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{t.remaining}</p>
            <PriceDisplay
              cents={data.remainingAmount}
              locale={priceLocale}
              className="mt-1 block text-3xl font-bold tabular-nums text-foreground sm:text-4xl"
            />

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-muted/40 px-3 py-2.5">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{t.total}</p>
                <PriceDisplay cents={data.totalAmount} locale={priceLocale} className="mt-0.5 block text-sm font-semibold tabular-nums" />
              </div>
              <div className="rounded-xl bg-emerald-500/10 px-3 py-2.5">
                <p className="text-[11px] uppercase tracking-wide text-emerald-700 dark:text-emerald-400">{t.paid}</p>
                <PriceDisplay
                  cents={data.totalPaid}
                  locale={priceLocale}
                  className="mt-0.5 block text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-400"
                />
              </div>
            </div>
          </div>
        </section>

        {data.canPay && token ? (
          <section className="mt-4 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
            <div className="px-4 py-4 sm:px-5 sm:py-5">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-muted-foreground" aria-hidden />
                <h2 className="text-sm font-semibold">{t.paymentType}</h2>
              </div>

              <div className="mt-3 grid gap-2" role="radiogroup">
                <PaymentTypeOption
                  active={paymentType === 'full'}
                  title={t.paymentTypeFull}
                  description={t.paymentTypeFullDesc}
                  onClick={() => {
                    setPaymentType('full');
                    setAmountInput(centsToEurosInput(data.remainingAmount));
                  }}
                  right={
                    <PriceDisplay
                      cents={data.remainingAmount}
                      locale={priceLocale}
                      className="text-sm font-semibold tabular-nums"
                    />
                  }
                />
                <PaymentTypeOption
                  active={paymentType === 'partial'}
                  title={t.paymentTypePartial}
                  description={t.paymentTypePartialDesc}
                  onClick={() => {
                    setPaymentType('partial');
                    if (amountInput === '' || parseEurosToCents(amountInput) === data.remainingAmount) {
                      setAmountInput('');
                    }
                  }}
                />
              </div>

              <div className="mt-4">
                <label htmlFor="amount-input" className="text-xs font-medium text-muted-foreground">
                  {t.amountPaid}
                </label>
                <div
                  className={`relative mt-1.5 flex items-center rounded-xl border bg-background transition-colors ${
                    amountError
                      ? 'border-destructive/60'
                      : 'border-input focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20'
                  } ${paymentType === 'full' ? 'opacity-70' : ''}`}
                >
                  <span className="select-none pl-3.5 pr-1 text-sm text-muted-foreground">€</span>
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
                    className="h-12 w-full min-w-0 bg-transparent pr-3.5 text-base font-semibold tabular-nums outline-none disabled:cursor-not-allowed"
                    placeholder="0.00"
                  />
                </div>
                {amountError ? (
                  <p className="mt-1.5 text-xs text-destructive">{amountError}</p>
                ) : (
                  <p className="mt-1.5 text-xs text-muted-foreground">{t.amountHint}</p>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between rounded-xl border border-dashed border-border/70 px-3 py-2.5">
                <span className="text-xs text-muted-foreground">{t.remainingAfter}</span>
                <PriceDisplay
                  cents={remainingAfterPayment}
                  locale={priceLocale}
                  className="text-sm font-semibold tabular-nums"
                />
              </div>
            </div>

            <div className="hidden border-t border-border/60 bg-muted/20 px-5 py-4 sm:block">
              <TokenPayButton
                token={token}
                type={paymentType}
                amountCents={selectedAmountCents}
                disabled={!canSubmit}
                label={t.payNow}
                loadingLabel={t.redirecting}
                errorMessage={t.createPaymentFailed}
                locale={locale}
              />
              <p className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
                <Lock className="h-3 w-3" aria-hidden /> {t.secureHosted}
              </p>
            </div>
          </section>
        ) : (
          <section className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
              <ShieldCheck className="h-6 w-6" aria-hidden />
            </div>
            <h3 className="mt-3 text-base font-semibold text-emerald-700 dark:text-emerald-400">{t.fullyPaid}</h3>
            <p className="mt-1 text-sm text-emerald-700/80 dark:text-emerald-400/80">{t.fullyPaidDesc}</p>
          </section>
        )}

        <p className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground sm:hidden">
          <Lock className="h-3 w-3" aria-hidden /> {t.secureHosted}
        </p>
      </div>

      {data.canPay && token ? (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border/70 bg-background/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-6px_20px_-10px_rgba(0,0,0,0.15)] backdrop-blur supports-backdrop-filter:bg-background/80 sm:hidden">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">{t.amountPaid}</span>
            <PriceDisplay
              cents={selectedAmountCents}
              locale={priceLocale}
              className="text-base font-bold tabular-nums"
            />
          </div>
          <TokenPayButton
            token={token}
            type={paymentType}
            amountCents={selectedAmountCents}
            disabled={!canSubmit}
            label={t.payNow}
            loadingLabel={t.redirecting}
            errorMessage={t.createPaymentFailed}
            locale={locale}
          />
        </div>
      ) : null}
    </main>
  );
}

function PaymentTypeOption({
  active,
  title,
  description,
  onClick,
  right,
}: {
  active: boolean;
  title: string;
  description: string;
  onClick: () => void;
  right?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={`group flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-all ${
        active
          ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
          : 'border-border/70 bg-background hover:border-border hover:bg-muted/40'
      }`}
    >
      <span
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
          active ? 'border-primary bg-primary' : 'border-border bg-background'
        }`}
        aria-hidden
      >
        {active ? <span className="h-2 w-2 rounded-full bg-primary-foreground" /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>
      </span>
      {right ? <span className="shrink-0">{right}</span> : null}
    </button>
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
  locale,
}: {
  token: string;
  type: 'full' | 'partial';
  amountCents: number;
  disabled: boolean;
  label: string;
  loadingLabel: string;
  errorMessage: string;
  locale: 'en' | 'fr';
}) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    try {
      setLoading(true);
      const idempotencyKey =
        typeof window !== 'undefined' && window.crypto?.randomUUID
          ? window.crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const response = await fetch(`/api/pay/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          amount: amountCents,
          locale,
          idempotencyKey,
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
      className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:brightness-105 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100"
    >
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          <span>{loadingLabel}</span>
        </>
      ) : (
        <>
          <CreditCard className="h-4 w-4" aria-hidden />
          <span>{label}</span>
        </>
      )}
    </button>
  );
}

function PaymentSuccessStatus({
  token,
  sessionId,
  locale,
  successTitle,
  errorTitle,
  confirmingLabel,
  successDescription,
  partialSuccessDescription,
  errorDescription,
  closeLabel,
  retryLabel,
  backToPaymentLabel,
  remainingLabel,
  fallbackError,
  onRetry,
}: {
  token: string;
  sessionId: string;
  locale: 'en' | 'fr';
  successTitle: string;
  errorTitle: string;
  confirmingLabel: string;
  successDescription: string;
  partialSuccessDescription: string;
  errorDescription: string;
  closeLabel: string;
  retryLabel: string;
  backToPaymentLabel: string;
  remainingLabel: string;
  fallbackError: string;
  onRetry: () => void;
}) {
  const [state, setState] = useState<{
    phase: 'confirming' | 'confirmed' | 'failed';
    message?: string;
    data?: ConfirmedPaymentData;
  }>({ phase: 'confirming' });

  const priceLocale = useMemo(() => (locale === 'fr' ? 'fr-FR' : 'en-GB'), [locale]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const response = await fetch(`/api/pay/${token}/confirm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        });

        const payload = (await response.json().catch(() => null)) as
          | { success?: boolean; data?: ConfirmedPaymentData; message?: string }
          | null;

        if (!response.ok || !payload?.success || !payload.data) {
          throw new Error(payload?.message || fallbackError);
        }

        if (!cancelled) {
          setState({ phase: 'confirmed', data: payload.data });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            phase: 'failed',
            message: error instanceof Error ? error.message : fallbackError,
          });
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [fallbackError, sessionId, token]);

  if (state.phase === 'confirming') {
    return (
      <main className="min-h-dvh flex flex-col items-center justify-center gap-4 bg-linear-to-b from-background via-background to-muted/40 px-6 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
        <p className="text-sm text-muted-foreground">{confirmingLabel}</p>
      </main>
    );
  }

  if (state.phase === 'failed') {
    return (
      <StatusScreen
        variant="failed"
        title={errorTitle}
        description={state.message || errorDescription}
        primaryLabel={retryLabel}
        onPrimary={onRetry}
      />
    );
  }

  const remainingAmount = Math.max(0, state.data?.remainingAmount ?? 0);
  const hasRemainingAmount = remainingAmount > 0 && state.data?.canPay;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-linear-to-b from-emerald-500/10 via-background to-background px-5 py-10">
      <div className="w-full max-w-md rounded-3xl border border-border/60 bg-card p-5 shadow-sm ring-1 ring-emerald-500/20 sm:p-8">
        <div className="mx-auto aspect-square w-full max-w-70">
          <StatusAnimation variant="success" />
        </div>
        <h1 className="mt-2 text-center text-xl font-bold text-emerald-700 dark:text-emerald-400 sm:text-2xl">
          {successTitle}
        </h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          {hasRemainingAmount ? partialSuccessDescription : successDescription}
        </p>

        {hasRemainingAmount ? (
          <div className="mt-5 rounded-2xl border border-amber-300/50 bg-amber-50/70 px-4 py-3 dark:border-amber-700/40 dark:bg-amber-950/20">
            <p className="text-center text-xs font-medium uppercase tracking-wide text-amber-800 dark:text-amber-300">
              {remainingLabel}
            </p>
            <PriceDisplay
              cents={remainingAmount}
              locale={priceLocale}
              className="mt-1 block text-center text-2xl font-bold tabular-nums text-amber-900 dark:text-amber-200"
            />
          </div>
        ) : null}

        <div className="mt-6 flex flex-col gap-3">
          {hasRemainingAmount ? (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:brightness-105 active:scale-[0.99]"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              <span>{backToPaymentLabel}</span>
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => window.close()}
            className={`inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold shadow-sm transition-all hover:brightness-105 active:scale-[0.99] ${
              hasRemainingAmount
                ? 'border border-border bg-background text-foreground'
                : 'bg-primary text-primary-foreground'
            }`}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            <span>{closeLabel}</span>
          </button>
        </div>
      </div>
    </main>
  );
}

function StatusAnimation({ variant }: { variant: 'success' | 'failed' }) {
  const [animationData, setAnimationData] = useState<unknown | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const url = variant === 'success' ? '/Payment Successful.json' : '/Payment Failed.json';
    fetch(url)
      .then((r) => r.json())
      .then((json) => {
        if (mountedRef.current) setAnimationData(json);
      })
      .catch(() => {});
    return () => {
      mountedRef.current = false;
    };
  }, [variant]);

  if (!animationData) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
      </div>
    );
  }

  return <Lottie animationData={animationData} loop={variant === 'failed'} autoplay />;
}

function StatusScreen({
  variant,
  title,
  description,
  primaryLabel,
  onPrimary,
}: {
  variant: 'success' | 'failed';
  title: string;
  description: string;
  primaryLabel: string;
  onPrimary: () => void;
}) {
  const accent =
    variant === 'success'
      ? 'from-emerald-500/10 via-background to-background'
      : 'from-rose-500/10 via-background to-background';
  const ringColor = variant === 'success' ? 'ring-emerald-500/20' : 'ring-rose-500/20';
  const titleColor =
    variant === 'success' ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400';

  return (
    <main className={`flex min-h-dvh flex-col items-center justify-center bg-linear-to-b px-5 py-10 ${accent}`}>
      <div className={`w-full max-w-md rounded-3xl border border-border/60 bg-card p-5 shadow-sm ring-1 sm:p-8 ${ringColor}`}>
        <div className="mx-auto aspect-square w-full max-w-70">
          <StatusAnimation variant={variant} />
        </div>
        <h1 className={`mt-2 text-center text-xl font-bold sm:text-2xl ${titleColor}`}>{title}</h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">{description}</p>

        <button
          type="button"
          onClick={onPrimary}
          className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:brightness-105 active:scale-[0.99]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          <span>{primaryLabel}</span>
        </button>
      </div>
    </main>
  );
}
