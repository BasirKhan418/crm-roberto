'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useParams } from 'next/navigation';
import { Loader2Icon } from 'lucide-react';
import { toast } from 'sonner';

import SignatureCanvas from '@/components/sign/SignatureCanvas';
import { PriceDisplay } from '@/components/ui/PriceDisplay';

interface SignQuotePayload {
  state?: 'ready' | 'already_signed';
  signedAt?: string | null;
  company?: {
    companyName: string;
    logoUrl: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    vatNumber?: string | null;
  };
  quoteNumber: string;
  date: string;
  clientSnapshot: {
    fullName: string;
    companyName?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
  };
  lineItems: Array<{
    _id?: string;
    name: string;
    quantity: number;
    baseUnitPriceExcludingTax?: number;
    unitPriceExcludingTax: number;
    discountPercentage?: number;
    discountAmountExcludingTax?: number;
    vatRate?: number;
    totalExcludingTax: number;
    totalExcludingTaxBeforeDiscount?: number;
    vatAmount?: number;
    totalIncludingTax?: number;
  }>;
  totalExcludingTax: number;
  totalVat: number;
  totalIncludingTax: number;
  notes?: string | null;
}

type SignQuoteApiPayload = Partial<SignQuotePayload> & { error?: string; companyName?: string };

type SignError = 'not_found' | 'expired' | 'already_signed' | 'link_no_longer_valid' | 'unknown';

function DisclosureSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <details className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm sm:rounded-3xl">
      <summary className="cursor-pointer list-none px-4 py-3.5 sm:px-5 sm:py-4 md:px-6 md:py-5">
        <div className="flex items-start justify-between gap-3 sm:gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-slate-950 sm:text-sm">{title}</p>
            <p className="mt-0.5 text-xs leading-5 text-slate-500 sm:mt-1 sm:text-sm sm:leading-6">{description}</p>
          </div>
          <span className="shrink-0 rounded-full border border-slate-200 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:px-3 sm:py-1 sm:text-xs">
            Open
          </span>
        </div>
      </summary>
      <div className="border-t border-slate-200 px-4 py-4 sm:px-5 sm:py-5 md:px-6 md:py-6">{children}</div>
    </details>
  );
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 py-2.5 last:border-b-0 last:pb-0 first:pt-0 sm:gap-4 sm:py-3">
      <span className="shrink-0 text-xs text-slate-500 sm:text-sm">{label}</span>
      <span className="min-w-0 break-all text-right text-xs font-medium text-slate-900 sm:text-sm">{value}</span>
    </div>
  );
}

export default function SignPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token;

  const [quote, setQuote] = useState<SignQuotePayload | null>(null);
  const [error, setError] = useState<SignError | null>(null);
  const [errorCompanyName, setErrorCompanyName] = useState<string>('this company');
  const [isLoading, setIsLoading] = useState(true);
  const [signed, setSigned] = useState(false);
  const [alreadySigned, setAlreadySigned] = useState(false);
  const [signedAt, setSignedAt] = useState<string | null>(null);
  const [isSigning, setIsSigning] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejected, setRejected] = useState(false);
  const [rejectionComment, setRejectionComment] = useState('');
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [confirmRejectIntent, setConfirmRejectIntent] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('not_found');
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    const loadQuote = async () => {
      setIsLoading(true);
      setError(null);
      setAlreadySigned(false);

      try {
        const response = await fetch(`/api/sign/${token}`, { cache: 'no-store' });
        const payload = (await response.json().catch(() => null)) as SignQuoteApiPayload | null;

        if (!response.ok) {
          const code = payload?.error;
          if (response.status === 404 || code === 'not_found') {
            throw new Error('not_found');
          }
          if (code === 'link_no_longer_valid') {
            if (payload?.companyName) {
              setErrorCompanyName(payload.companyName);
            }
            throw new Error('link_no_longer_valid');
          }
          if (response.status === 410 || code === 'expired') {
            if (payload?.companyName) {
              setErrorCompanyName(payload.companyName);
            }
            throw new Error('expired');
          }
          if (response.status === 409 || code === 'already_signed') {
            throw new Error('already_signed');
          }

          throw new Error('unknown');
        }

        if (!isMounted) {
          return;
        }

        setQuote(payload as SignQuotePayload);

        if (payload?.state === 'already_signed') {
          setSignedAt(payload.signedAt ?? null);
          setAlreadySigned(true);
        }
      } catch (loadError) {
        if (!isMounted) {
          return;
        }

        const code = loadError instanceof Error ? loadError.message : 'unknown';
        if (code === 'not_found' || code === 'expired' || code === 'already_signed' || code === 'link_no_longer_valid') {
          setError(code);
          if (code === 'already_signed') {
            setAlreadySigned(true);
          }
        } else {
          setError('unknown');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadQuote();

    return () => {
      isMounted = false;
    };
  }, [token]);

  const companyName = quote?.company?.companyName || 'Our Company';
  const locale = 'en-GB';

  const formattedDate = useMemo(() => {
    if (!quote?.date) {
      return '-';
    }

    return new Intl.DateTimeFormat(locale, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(quote.date));
  }, [quote?.date]);

  const formattedSignedAt = useMemo(() => {
    if (!signedAt) {
      return null;
    }

    return new Intl.DateTimeFormat(locale, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(signedAt));
  }, [locale, signedAt]);

  const totalDiscount = useMemo(() => {
    if (!quote) {
      return 0;
    }

    return quote.lineItems.reduce((sum, item) => sum + (item.discountAmountExcludingTax ?? 0), 0);
  }, [quote]);

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'EUR',
      }),
    [locale],
  );

  const itemCount = quote?.lineItems.length ?? 0;

  const handleSign = async () => {
    if (!signatureDataUrl || !token) {
      toast.error('Please provide your signature before submitting.');
      return;
    }

    setIsSigning(true);

    try {
      const response = await fetch(`/api/sign/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signatureDataUrl }),
      });
      const payload = (await response.json().catch(() => null)) as SignQuoteApiPayload | null;

      if (response.ok) {
        setSignedAt(payload?.signedAt ?? new Date().toISOString());
        setAlreadySigned(false);
        setError(null);
        setSigned(true);
        return;
      }

      if (response.status === 404) {
        setError('not_found');
      } else if (response.status === 410) {
        setError(payload?.error === 'link_no_longer_valid' ? 'link_no_longer_valid' : 'expired');
      } else if (response.status === 409) {
        if (payload?.quoteNumber) {
          setQuote(payload as SignQuotePayload);
        }
        setSignedAt(payload?.signedAt ?? new Date().toISOString());
        setAlreadySigned(true);
        setError('already_signed');
        return;
      } else {
        setError('unknown');
      }
    } finally {
      setIsSigning(false);
    }
  };

  const handleReject = async () => {
    if (!token || !confirmRejectIntent) return;
    setIsRejecting(true);
    try {
      const response = await fetch(`/api/sign/${token}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: rejectionComment.trim() || null }),
      });
      if (response.ok || response.status === 409) {
        setShowRejectDialog(false);
        setRejected(true);
      } else {
        toast.error('Unable to submit your rejection. Please try again.');
      }
    } catch {
      toast.error('A network error occurred. Please try again.');
    } finally {
      setIsRejecting(false);
    }
  };

  const renderError = () => {
    if (!error) {
      return null;
    }

    const text =
      error === 'not_found'
        ? 'This signing link is invalid or has been removed.'
        : error === 'expired'
          ? `This signing link has expired. Please contact ${errorCompanyName} for a new link.`
          : error === 'link_no_longer_valid'
            ? 'This link is no longer valid. Please request a new signing link.'
            : 'Something went wrong while loading this quote.';

    return (
      <section className="overflow-hidden rounded-2xl border border-rose-200 bg-white shadow-xl shadow-slate-950/5 sm:rounded-3xl">
        <div className="border-b border-rose-100 bg-rose-50 px-4 py-4 sm:px-6 sm:py-5 md:px-8 md:py-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-rose-700 sm:text-xs">Unable to continue</p>
          <h1 className="mt-2 text-xl font-semibold tracking-tight text-slate-950 sm:mt-3 sm:text-2xl md:text-3xl">This signing page is not available</h1>
        </div>
        <div className="px-4 py-4 sm:px-6 sm:py-5 md:px-8 md:py-6">
          <p className="text-xs leading-5 text-slate-600 sm:text-sm sm:leading-6">{text}</p>
        </div>
      </section>
    );
  };

  const renderAlreadySigned = () => {
    const signerName = quote?.clientSnapshot.fullName || 'Client';

    return (
      <section className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-xl shadow-slate-950/5 sm:rounded-3xl">
        <div className="border-b border-emerald-100 bg-emerald-50 px-4 py-4 sm:px-6 sm:py-5 md:px-8 md:py-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-700 sm:text-xs">Already signed</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-emerald-950 sm:mt-3 sm:text-3xl md:text-4xl">This quote has already been signed</h1>
          <p className="mt-2 text-xs leading-5 text-emerald-900/80 sm:mt-3 sm:text-sm sm:leading-6 md:text-base">
            No further action is needed, {signerName}. {companyName} already has this signed quote{formattedSignedAt ? ` recorded on ${formattedSignedAt}` : ''}.
          </p>
        </div>

        <div className="grid gap-4 px-4 py-4 sm:px-6 sm:py-6 md:px-8 md:py-8 lg:grid-cols-[1fr_minmax(0,0.82fr)]">
          <div className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:rounded-3xl sm:p-5 md:p-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500 sm:text-xs">Recorded reference</p>
            {quote ? (
              <div className="mt-3 grid grid-cols-1 gap-2.5 min-[400px]:grid-cols-3 sm:mt-4 sm:gap-3">
                <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 sm:rounded-2xl sm:p-4">
                  <p className="text-[10px] uppercase tracking-wide text-slate-500 sm:text-xs">Quote</p>
                  <p className="mt-1 truncate text-base font-semibold text-slate-950 sm:mt-2 sm:text-lg">{quote.quoteNumber}</p>
                </div>
                <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 sm:rounded-2xl sm:p-4">
                  <p className="text-[10px] uppercase tracking-wide text-slate-500 sm:text-xs">Date</p>
                  <p className="mt-1 text-base font-semibold text-slate-950 sm:mt-2 sm:text-lg">{formattedDate}</p>
                </div>
                <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 sm:rounded-2xl sm:p-4">
                  <p className="text-[10px] uppercase tracking-wide text-slate-500 sm:text-xs">Total incl. tax</p>
                  <p className="mt-1 truncate text-base font-semibold text-slate-950 sm:mt-2 sm:text-lg">
                    <PriceDisplay cents={quote.totalIncludingTax} locale={locale} />
                  </p>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-xs leading-5 text-slate-600 sm:mt-4 sm:text-sm sm:leading-6">
                This signing link has already been completed. If you need a copy of the quote or confirmation details, contact {companyName}.
              </p>
            )}
          </div>

          <div className="min-w-0 space-y-3 sm:space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:rounded-3xl sm:p-5 md:p-6">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500 sm:text-xs">What happens next</p>
              <div className="mt-3 space-y-2.5 text-xs leading-5 text-slate-600 sm:mt-4 sm:space-y-3 sm:text-sm sm:leading-6">
                <p>The quote remains marked as signed in {companyName}&apos;s system.</p>
                <p>No additional signature is required from you on this page.</p>
                <p>You can close this page now and keep the original email for your records.</p>
              </div>
            </div>

            {quote?.company?.email || quote?.company?.phone ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:rounded-3xl sm:p-5 md:p-6">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500 sm:text-xs">Need help?</p>
                <div className="mt-3 space-y-2 sm:mt-4 sm:space-y-3">
                  {quote.company?.email ? <DetailRow label="Email" value={quote.company.email} /> : null}
                  {quote.company?.phone ? <DetailRow label="Phone" value={quote.company.phone} /> : null}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    );
  };

  const isAlreadySignedState = alreadySigned || error === 'already_signed';

  return (
    <main className="min-h-dvh w-full overflow-x-hidden bg-[linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)] px-3 py-4 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] sm:px-4 sm:py-6 md:px-6 md:py-8 lg:py-10">
      <div className="mx-auto w-full max-w-5xl">
        {isLoading ? (
          <div className="flex min-h-[50dvh] flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-10 text-center shadow-xl shadow-slate-950/5 sm:rounded-3xl sm:px-6 sm:py-12">
            <Loader2Icon className="size-5 animate-spin text-slate-500 sm:size-6" />
            <p className="text-xs text-slate-600 sm:text-sm">Loading quote details...</p>
          </div>
        ) : isAlreadySignedState ? (
          renderAlreadySigned()
        ) : error ? (
          renderError()
        ) : rejected ? (
          <section className="overflow-hidden rounded-2xl border border-orange-200 bg-white shadow-xl shadow-slate-950/5 sm:rounded-3xl">
            <div className="border-b border-orange-100 bg-orange-50 px-4 py-4 sm:px-6 sm:py-5 md:px-8 md:py-6">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-orange-700 sm:text-xs">Rejection submitted</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-orange-950 sm:mt-3 sm:text-3xl md:text-4xl">Quote rejected</h1>
              <p className="mt-2 text-xs leading-5 text-orange-900/80 sm:mt-3 sm:text-sm sm:leading-6 md:text-base">
                Thank you, {quote?.clientSnapshot.fullName || 'Client'}. {companyName} has been notified and will be in touch with an updated quote.
              </p>
            </div>
            <div className="px-4 py-4 sm:px-6 sm:py-6 md:px-8 md:py-8">
              {rejectionComment.trim() ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:rounded-3xl sm:p-5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500 sm:text-xs">Your comment</p>
                  <p className="mt-2 text-sm leading-6 text-slate-700 sm:mt-3">{rejectionComment.trim()}</p>
                </div>
              ) : null}
            </div>
          </section>
        ) : signed ? (
         
          <section className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-xl shadow-slate-950/5 sm:rounded-3xl">
            <div className="border-b border-emerald-100 bg-emerald-50 px-4 py-4 sm:px-6 sm:py-5 md:px-8 md:py-6">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-700 sm:text-xs">Signature completed</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-emerald-950 sm:mt-3 sm:text-3xl md:text-4xl">Quote signed successfully</h1>
              <p className="mt-2 text-xs leading-5 text-emerald-900/80 sm:mt-3 sm:text-sm sm:leading-6 md:text-base">
                Thank you, {quote?.clientSnapshot.fullName || 'Client'}. Your signature has been recorded{formattedSignedAt ? ` on ${formattedSignedAt}` : ''} and this quote is now marked as signed.
              </p>
            </div>

            <div className="grid gap-4 px-4 py-4 sm:px-6 sm:py-6 md:px-8 md:py-8 lg:grid-cols-[1fr_minmax(0,0.82fr)]">
              <div className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:rounded-3xl sm:p-5 md:p-6">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500 sm:text-xs">Recorded reference</p>
                <div className="mt-3 grid grid-cols-1 gap-2.5 min-[400px]:grid-cols-3 sm:mt-4 sm:gap-3">
                  <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 sm:rounded-2xl sm:p-4">
                    <p className="text-[10px] uppercase tracking-wide text-slate-500 sm:text-xs">Quote</p>
                    <p className="mt-1 truncate text-base font-semibold text-slate-950 sm:mt-2 sm:text-lg">{quote?.quoteNumber}</p>
                  </div>
                  <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 sm:rounded-2xl sm:p-4">
                    <p className="text-[10px] uppercase tracking-wide text-slate-500 sm:text-xs">Date</p>
                    <p className="mt-1 text-base font-semibold text-slate-950 sm:mt-2 sm:text-lg">{formattedDate}</p>
                  </div>
                  <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 sm:rounded-2xl sm:p-4">
                    <p className="text-[10px] uppercase tracking-wide text-slate-500 sm:text-xs">Total incl. tax</p>
                    <p className="mt-1 truncate text-base font-semibold text-slate-950 sm:mt-2 sm:text-lg">
                      <PriceDisplay cents={quote?.totalIncludingTax ?? 0} locale={locale} />
                    </p>
                  </div>
                </div>
              </div>

              <div className="min-w-0 space-y-3 sm:space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:rounded-3xl sm:p-5 md:p-6">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500 sm:text-xs">What happens next</p>
                  <div className="mt-3 space-y-2.5 text-xs leading-5 text-slate-600 sm:mt-4 sm:space-y-3 sm:text-sm sm:leading-6">
                    <p>The quote is now marked as signed in {companyName}&apos;s system.</p>
                    <p>{companyName} can continue with the next step on their side using the accepted quote.</p>
                    <p>You can close this page now. Keep the original email if you need to refer to the quote again.</p>
                  </div>
                </div>

                {quote?.company?.email || quote?.company?.phone ? (
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:rounded-3xl sm:p-5 md:p-6">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500 sm:text-xs">Need help?</p>
                    <div className="mt-3 space-y-2 sm:mt-4 sm:space-y-3">
                      {quote.company?.email ? <DetailRow label="Email" value={quote.company.email} /> : null}
                      {quote.company?.phone ? <DetailRow label="Phone" value={quote.company.phone} /> : null}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        ) : quote ? (
         
          <div className="space-y-4 sm:space-y-5">
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-950/5 sm:rounded-3xl">
              <header className="border-b border-slate-200 px-4 py-3.5 sm:px-6 sm:py-4 md:px-8 md:py-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
                    {quote.company?.logoUrl ? (
                      <Image
                        src={quote.company.logoUrl}
                        alt={companyName}
                        width={128}
                        height={48}
                        className="h-9 w-auto shrink-0 object-contain sm:h-11"
                      />
                    ) : null}
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500 sm:text-xs">Issued by</p>
                      <p className="mt-0.5 truncate text-sm font-semibold text-slate-950 sm:mt-1 sm:text-base">{companyName}</p>
                    </div>
                  </div>
                  <div className="inline-flex shrink-0 self-start rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600 sm:self-auto sm:px-3 sm:py-1 sm:text-xs">
                    Secure signing page
                  </div>
                </div>
              </header>

              <div className="grid gap-5 px-4 py-5 sm:gap-6 sm:px-6 sm:py-6 md:px-8 md:py-8 lg:grid-cols-[1fr_minmax(0,0.75fr)] lg:items-start">

                <section className="min-w-0 space-y-4 sm:space-y-5">
                  <div className="space-y-3 sm:space-y-4">
                    <div className="inline-flex rounded-full bg-slate-950 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white sm:px-3 sm:py-1 sm:text-xs">
                      Final step
                    </div>
                    <div className="min-w-0">
                      <h1 className="wrap-break-word text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl md:text-3xl lg:text-4xl">
                        Review and sign quote {quote.quoteNumber}
                      </h1>
                      <p className="mt-2 text-xs leading-5 text-slate-600 sm:mt-3 sm:text-sm sm:leading-6 md:text-base">
                        Please check the essentials below, add your signature, and the quote will be recorded immediately.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmRejectIntent(false);
                          setShowRejectDialog(true);
                        }}
                        disabled={isSigning}
                        className="mt-3 inline-flex h-9 items-center justify-center rounded-full border border-red-300 bg-red-50 px-3.5 text-xs font-semibold text-red-800 transition hover:border-red-400 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 sm:mt-4 sm:h-10 sm:px-4 sm:text-sm"
                      >
                        Reject this quote
                      </button>
                    </div>
                  </div>

                  {/* Stats grid */}
                  <div className="grid grid-cols-1 gap-2.5 min-[400px]:grid-cols-3 sm:gap-3">
                    <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:rounded-2xl sm:p-4">
                      <p className="text-[10px] uppercase tracking-wide text-slate-500 sm:text-xs">Total incl. tax</p>
                      <p className="mt-1 truncate text-lg font-semibold text-slate-950 sm:mt-2 sm:text-xl">
                        <PriceDisplay cents={quote.totalIncludingTax} locale={locale} />
                      </p>
                    </div>
                    <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:rounded-2xl sm:p-4">
                      <p className="text-[10px] uppercase tracking-wide text-slate-500 sm:text-xs">Issued on</p>
                      <p className="mt-1 truncate text-lg font-semibold text-slate-950 sm:mt-2 sm:text-xl">{formattedDate}</p>
                    </div>
                    <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:rounded-2xl sm:p-4">
                      <p className="text-[10px] uppercase tracking-wide text-slate-500 sm:text-xs">Client</p>
                      <p className="mt-1 truncate text-lg font-semibold text-slate-950 sm:mt-2 sm:text-xl">{quote.clientSnapshot.companyName || quote.clientSnapshot.fullName}</p>
                    </div>
                  </div>

                  {/* Steps */}
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 sm:rounded-3xl sm:p-4 md:p-5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500 sm:text-xs">Before you sign</p>
                    <div className="mt-3 space-y-2.5 sm:mt-4 sm:space-y-3">
                      <div className="flex gap-2.5 rounded-xl border border-slate-200 bg-white p-3 sm:gap-3 sm:rounded-2xl sm:p-4">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-950 text-[10px] font-semibold text-white sm:h-8 sm:w-8 sm:text-xs">1</div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-slate-950 sm:text-sm">Review the essentials</p>
                          <p className="mt-0.5 text-xs leading-5 text-slate-600 sm:mt-1 sm:text-sm sm:leading-6">The total, quote reference, and optional full breakdown are available below.</p>
                        </div>
                      </div>
                      <div className="flex gap-2.5 rounded-xl border border-slate-200 bg-white p-3 sm:gap-3 sm:rounded-2xl sm:p-4">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-950 text-[10px] font-semibold text-white sm:h-8 sm:w-8 sm:text-xs">2</div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-slate-950 sm:text-sm">Add your signature</p>
                          <p className="mt-0.5 text-xs leading-5 text-slate-600 sm:mt-1 sm:text-sm sm:leading-6">Use your finger or mouse to sign. You can clear and redraw before you submit.</p>
                        </div>
                      </div>
                      <div className="flex gap-2.5 rounded-xl border border-slate-200 bg-white p-3 sm:gap-3 sm:rounded-2xl sm:p-4">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-950 text-[10px] font-semibold text-white sm:h-8 sm:w-8 sm:text-xs">3</div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-slate-950 sm:text-sm">Get immediate confirmation</p>
                          <p className="mt-0.5 text-xs leading-5 text-slate-600 sm:mt-1 sm:text-sm sm:leading-6">As soon as you submit, the quote is marked as signed and the process is complete.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="min-w-0 lg:sticky lg:top-6">
                  <div className="overflow-hidden rounded-2xl bg-slate-950 p-4 text-white shadow-xl shadow-slate-950/15 sm:rounded-3xl sm:p-5 md:p-6">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300 sm:text-xs">Sign this quote</p>
                    <h2 className="mt-2 text-xl font-semibold tracking-tight sm:mt-3 sm:text-2xl">Complete the agreement</h2>
                    <p className="mt-2 text-xs leading-5 text-slate-300 sm:mt-3 sm:text-sm sm:leading-6">
                      Draw your signature below to confirm your agreement with this quote.
                    </p>

                    <div className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-white/5 p-3 sm:mt-5 sm:rounded-2xl sm:p-4">
                      <div className="flex items-center justify-between gap-2 sm:gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400 sm:text-xs">Quote total</p>
                          <p className="mt-1 truncate text-xl font-semibold text-white sm:mt-2 sm:text-2xl">
                            <PriceDisplay cents={quote.totalIncludingTax} locale={locale} className="text-white" />
                          </p>
                        </div>
                        <div className="shrink-0 rounded-full border border-white/10 bg-white/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-200 sm:px-3 sm:py-1 sm:text-xs">
                          {itemCount} items
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 overflow-hidden rounded-2xl bg-white p-3 text-slate-950 sm:mt-5 sm:rounded-3xl sm:p-4 md:p-5">
                      <p className="text-[13px] font-semibold text-slate-950 sm:text-sm">Signature</p>
                      <p className="mt-0.5 text-xs leading-5 text-slate-600 sm:mt-1 sm:text-sm sm:leading-6">
                        Use your finger or mouse to sign. You can clear and redraw before submitting.
                      </p>
                      <div className="mt-3 sm:mt-4">
                        <SignatureCanvas onSignatureChange={setSignatureDataUrl} />
                      </div>
                    </div>

                    <p className="mt-3 text-[10px] leading-4 text-slate-400 sm:mt-4 sm:text-xs sm:leading-5">
                      By submitting your signature, you confirm that you agree with this quote.
                    </p>

                    <button
                      type="button"
                      onClick={handleSign}
                      disabled={isSigning || !signatureDataUrl}
                      className="mt-4 h-11 w-full rounded-xl bg-white px-4 text-[13px] font-semibold text-slate-950 transition active:scale-[0.98] hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-white/40 disabled:text-slate-500 sm:mt-5 sm:h-12 sm:rounded-2xl sm:text-sm"
                    >
                      {isSigning
                        ? 'Recording your signature...'
                        : signatureDataUrl
                          ? 'Verify & Sign quote'
                          : 'Add signature to Verify & Sign'}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setConfirmRejectIntent(false);
                        setShowRejectDialog(true);
                      }}
                      disabled={isSigning}
                      className="mt-3 h-11 w-full rounded-xl border border-red-300 bg-red-500/10 px-4 text-[12px] font-semibold text-red-100 transition hover:border-red-200 hover:bg-red-500/20 hover:text-white active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 sm:mt-4 sm:h-11 sm:rounded-2xl sm:text-sm"
                    >
                      Reject this quote
                    </button>
                  </div>
                </section>
              </div>
            </section>

            {/* Rejection dialog */}
            {showRejectDialog ? (
              <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 p-4 sm:p-6" onClick={() => setShowRejectDialog(false)}>
                <div className="flex min-h-full items-start justify-center pt-6 sm:items-center sm:pt-0">
                  <div
                    className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl sm:rounded-3xl"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="border-b border-slate-200 px-5 py-4 sm:px-6 sm:py-5">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-red-600 sm:text-xs">Reject quote</p>
                      <h2 className="mt-1 text-base font-semibold text-slate-950 sm:mt-2 sm:text-lg">Are you absolutely sure you want to reject this quote?</h2>
                      <p className="mt-1 text-xs leading-5 text-slate-600 sm:mt-2 sm:text-sm sm:leading-6">
                        This will immediately mark the quote as rejected. {companyName} will be notified and must issue an updated quote if you want to continue.
                      </p>
                    </div>

                    <div className="max-h-[min(62dvh,520px)] space-y-3 overflow-y-auto px-5 py-4 sm:space-y-4 sm:px-6 sm:py-5">
                      <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-xs leading-5 text-red-900 sm:rounded-2xl sm:px-4 sm:py-3.5 sm:text-sm">
                        Once confirmed, this sign link is closed and cannot be used to sign this version later.
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 sm:text-xs" htmlFor="rejection-comment">
                          Comment (optional)
                        </label>
                        <textarea
                          id="rejection-comment"
                          rows={4}
                          maxLength={1000}
                          value={rejectionComment}
                          onChange={(e) => setRejectionComment(e.target.value)}
                          placeholder="e.g. The price is too high, please revise line item 2..."
                          className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-950 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none sm:rounded-2xl sm:px-4 sm:py-3"
                        />
                        <p className="mt-1 text-right text-[10px] text-slate-400 sm:text-xs">{rejectionComment.length}/1000</p>
                      </div>

                      <label className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 sm:rounded-2xl sm:px-4 sm:py-3">
                        <input
                          type="checkbox"
                          checked={confirmRejectIntent}
                          onChange={(e) => setConfirmRejectIntent(e.target.checked)}
                          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                        />
                        <span className="text-xs leading-5 text-slate-700 sm:text-sm sm:leading-6">
                          I understand this will reject the quote now and I will need a new revised quote to continue.
                        </span>
                      </label>
                    </div>

                    <div className="flex flex-col gap-2 border-t border-slate-200 bg-white px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:flex-row sm:gap-3 sm:px-6 sm:py-5">
                      <button
                        type="button"
                        onClick={() => {
                          setShowRejectDialog(false);
                          setConfirmRejectIntent(false);
                        }}
                        disabled={isRejecting}
                        className="h-11 w-full rounded-xl border border-slate-200 px-4 text-[13px] font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 sm:h-11 sm:flex-1 sm:rounded-2xl sm:text-sm"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleReject}
                        disabled={isRejecting || !confirmRejectIntent}
                        className="h-11 w-full rounded-xl bg-red-600 px-4 text-[13px] font-semibold text-white transition hover:bg-red-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 sm:h-11 sm:flex-1 sm:rounded-2xl sm:text-sm"
                      >
                        {isRejecting ? 'Submitting rejection...' : 'Yes, reject quote'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="grid gap-3 sm:gap-4 lg:grid-cols-[1fr_minmax(0,0.67fr)]">
              <DisclosureSection
                title="Review full quote details"
                description="Open this section if you want to inspect every line item before signing."
              >
                <div className="space-y-3 md:hidden">
                  {quote.lineItems.map((item, index) => {
                    const discountPct = item.discountPercentage ?? 0;
                    const discountAmount = item.discountAmountExcludingTax ?? 0;
                    const vatRate = item.vatRate ?? 0;
                    const lineTotal = item.totalIncludingTax ?? item.totalExcludingTax;
                    const discountLabel =
                      discountPct > 0 || discountAmount > 0
                        ? `${discountPct.toFixed(2)}%${discountAmount > 0 ? ` (-${currencyFormatter.format(discountAmount / 100)})` : ''}`
                        : 'None';

                    return (
                      <article key={item._id ?? `${item.name}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3 sm:rounded-2xl sm:p-4">
                        <p className="wrap-break-word text-[13px] font-semibold text-slate-950 sm:text-sm">{item.name}</p>
                        <div className="mt-2.5 space-y-1.5 sm:mt-3 sm:space-y-2">
                          <DetailRow label="Quantity" value={item.quantity} />
                          <DetailRow label="Unit excl. tax" value={<PriceDisplay cents={item.unitPriceExcludingTax} locale={locale} />} />
                          <DetailRow label="Discount" value={discountLabel} />
                          <DetailRow label="VAT" value={`${vatRate}%`} />
                          <DetailRow label="Line total" value={<PriceDisplay cents={lineTotal} locale={locale} />} />
                        </div>
                      </article>
                    );
                  })}
                </div>

                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                        <th className="rounded-l-xl px-4 py-3">Description</th>
                        <th className="whitespace-nowrap px-4 py-3 text-right">Qty</th>
                        <th className="whitespace-nowrap px-4 py-3 text-right">Unit excl.</th>
                        <th className="whitespace-nowrap px-4 py-3 text-right">Discount</th>
                        <th className="whitespace-nowrap px-4 py-3 text-right">VAT</th>
                        <th className="whitespace-nowrap rounded-r-xl px-4 py-3 text-right">Line total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quote.lineItems.map((item, index) => {
                        const discountPct = item.discountPercentage ?? 0;
                        const discountAmount = item.discountAmountExcludingTax ?? 0;
                        const vatRate = item.vatRate ?? 0;
                        const lineTotal = item.totalIncludingTax ?? item.totalExcludingTax;

                        return (
                          <tr key={item._id ?? `${item.name}-${index}`} className="border-b border-slate-200 last:border-b-0">
                            <td className="max-w-50 wrap-break-word px-4 py-3 text-slate-950">{item.name}</td>
                            <td className="whitespace-nowrap px-4 py-3 text-right text-slate-700">{item.quantity}</td>
                            <td className="whitespace-nowrap px-4 py-3 text-right text-slate-700">
                              <PriceDisplay cents={item.unitPriceExcludingTax} locale={locale} />
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-right text-slate-700">
                              {discountPct > 0 || discountAmount > 0
                                ? `${discountPct.toFixed(2)}%${discountAmount > 0 ? ` (-${currencyFormatter.format(discountAmount / 100)})` : ''}`
                                : 'None'}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-right text-slate-700">{vatRate}%</td>
                            <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-slate-950">
                              <PriceDisplay cents={lineTotal} locale={locale} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Totals summary */}
                <div className="mt-4 grid gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:mt-5 sm:gap-3 sm:rounded-2xl sm:p-4 md:ml-auto md:max-w-sm">
                  <div className="flex items-center justify-between text-xs text-slate-600 sm:text-sm">
                    <span>Total excl. tax</span>
                    <PriceDisplay cents={quote.totalExcludingTax} locale={locale} />
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-600 sm:text-sm">
                    <span>Discount</span>
                    <span>- <PriceDisplay cents={totalDiscount} locale={locale} /></span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-600 sm:text-sm">
                    <span>VAT</span>
                    <PriceDisplay cents={quote.totalVat} locale={locale} />
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-300 pt-2.5 text-sm font-semibold text-slate-950 sm:pt-3 sm:text-base">
                    <span>Total incl. tax</span>
                    <PriceDisplay cents={quote.totalIncludingTax} locale={locale} />
                  </div>
                </div>

                {quote.notes ? (
                  <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3 sm:mt-5 sm:rounded-2xl sm:p-4 md:p-5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500 sm:text-xs">Notes</p>
                    <p className="mt-2 whitespace-pre-wrap wrap-break-word text-xs leading-5 text-slate-600 sm:mt-3 sm:text-sm sm:leading-6">{quote.notes}</p>
                  </div>
                ) : null}
              </DisclosureSection>

              <div className="min-w-0 space-y-3 sm:space-y-4">
                <DisclosureSection
                  title="Company details"
                  description="Contact information for the company issuing this quote."
                >
                  <div className="space-y-1">
                    <DetailRow label="Company" value={companyName} />
                    {quote.company?.address ? <DetailRow label="Address" value={quote.company.address} /> : null}
                    {quote.company?.phone ? <DetailRow label="Phone" value={quote.company.phone} /> : null}
                    {quote.company?.email ? <DetailRow label="Email" value={quote.company.email} /> : null}
                    {quote.company?.vatNumber ? <DetailRow label="VAT" value={quote.company.vatNumber} /> : null}
                  </div>
                </DisclosureSection>

                <DisclosureSection
                  title="Client details"
                  description="The information currently recorded for this quote."
                >
                  <div className="space-y-1">
                    <DetailRow label="Name" value={quote.clientSnapshot.fullName} />
                    {quote.clientSnapshot.companyName ? <DetailRow label="Company" value={quote.clientSnapshot.companyName} /> : null}
                    {quote.clientSnapshot.phone ? <DetailRow label="Phone" value={quote.clientSnapshot.phone} /> : null}
                    {quote.clientSnapshot.email ? <DetailRow label="Email" value={quote.clientSnapshot.email} /> : null}
                    {quote.clientSnapshot.address ? <DetailRow label="Address" value={quote.clientSnapshot.address} /> : null}
                  </div>
                </DisclosureSection>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}