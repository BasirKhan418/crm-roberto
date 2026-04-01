'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2Icon } from 'lucide-react';
import {toast} from "sonner";
import SignatureCanvas from '@/components/sign/SignatureCanvas';
import { PriceDisplay } from '@/components/ui/PriceDisplay';

interface SignQuotePayload {
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

type SignError = 'not_found' | 'expired' | 'already_signed' | 'link_no_longer_valid' | 'unknown';

export default function SignPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token;

  const [quote, setQuote] = useState<SignQuotePayload | null>(null);
  const [error, setError] = useState<SignError | null>(null);
  const [errorCompanyName, setErrorCompanyName] = useState<string>('this company');
  const [isLoading, setIsLoading] = useState(true);
  const [signed, setSigned] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);

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

      try {
        const response = await fetch(`/api/sign/${token}`, { cache: 'no-store' });
        const payload = (await response.json().catch(() => null)) as
          | (Partial<SignQuotePayload> & { error?: string; companyName?: string })
          | null;

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
      } catch (loadError) {
        if (!isMounted) {
          return;
        }

        const code = loadError instanceof Error ? loadError.message : 'unknown';
        if (code === 'not_found' || code === 'expired' || code === 'already_signed' || code === 'link_no_longer_valid') {
          setError(code);
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

  const totalDiscount = useMemo(() => {
    if (!quote) {
      return 0;
    }

    return quote.lineItems.reduce((sum, item) => sum + (item.discountAmountExcludingTax ?? 0), 0);
  }, [quote]);

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

      if (response.ok) {
        setSigned(true);
        return;
      }

      if (response.status === 404) {
        setError('not_found');
      } else if (response.status === 410) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(payload?.error === 'link_no_longer_valid' ? 'link_no_longer_valid' : 'expired');
      } else if (response.status === 409) {
        setError('already_signed');
      } else {
        setError('unknown');
      }
    } finally {
      setIsSigning(false);
    }
  };

  const renderError = () => {
    if (!error) {
      return null;
    }

    const text =
      error === 'not_found'
        ? 'This link is invalid or has been removed.'
        : error === 'expired'
          ? `This signing link has expired. Please contact ${errorCompanyName} for a new link.`
          : error === 'link_no_longer_valid'
            ? 'This link is no longer valid. Please request a new signing link.'
          : error === 'already_signed'
            ? 'This quote has already been signed. Thank you!'
            : 'Something went wrong while loading this quote.';

    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <h1 className="text-lg font-semibold">Unable to continue</h1>
        <p className="mt-2 text-sm text-muted-foreground">{text}</p>
      </div>
    );
  };

  return (
    <main className="min-h-screen bg-[#f6f7f9] px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-180 rounded-xl border border-border bg-white p-5 shadow-sm sm:p-8">
        {isLoading ? (
          <div className="flex min-h-70 flex-col items-center justify-center gap-3">
            <Loader2Icon className="size-6 animate-spin text-slate-500" />
            <p className="text-sm text-slate-600">Loading quote details...</p>
          </div>
        ) : error ? (
          renderError()
        ) : signed ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6">
            <h1 className="text-xl font-semibold text-emerald-800">Quote signed. Thank you, {quote?.clientSnapshot.fullName || 'Client'}!</h1>
            <p className="mt-2 text-sm text-emerald-700">Your signature has been recorded successfully.</p>
          </div>
        ) : quote ? (
          <div className="space-y-7">
            <header className="flex items-center justify-between gap-4 border-b border-border pb-5">
              <div className="flex items-center gap-3">
                {quote.company?.logoUrl ? (
                  <Image
                    src={quote.company.logoUrl}
                    alt={companyName}
                    width={110}
                    height={40}
                    className="h-10 w-auto object-contain"
                  />
                ) : null}
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Issued by</p>
                  <p className="text-base font-semibold text-slate-900">{companyName}</p>
                </div>
              </div>
            </header>

            <section>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Quote {quote.quoteNumber} - Please review and sign</h1>
              <p className="mt-2 text-sm text-slate-600">Date: {formattedDate}</p>
            </section>

            <section className="grid gap-4 sm:grid-cols-2">
              <article className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-600">Issuer</h2>
                <div className="space-y-1.5 text-sm">
                  <p className="flex justify-between gap-3"><span className="text-slate-500">Company</span><span className="font-medium text-slate-900 text-right">{companyName}</span></p>
                  {quote.company?.address ? <p className="flex justify-between gap-3"><span className="text-slate-500">Address</span><span className="text-slate-900 text-right">{quote.company.address}</span></p> : null}
                  {quote.company?.phone ? <p className="flex justify-between gap-3"><span className="text-slate-500">Phone</span><span className="text-slate-900 text-right">{quote.company.phone}</span></p> : null}
                  {quote.company?.email ? <p className="flex justify-between gap-3"><span className="text-slate-500">Email</span><span className="text-slate-900 text-right">{quote.company.email}</span></p> : null}
                  {quote.company?.vatNumber ? <p className="flex justify-between gap-3"><span className="text-slate-500">VAT</span><span className="text-slate-900 text-right">{quote.company.vatNumber}</span></p> : null}
                </div>
              </article>

              <article className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-600">Client</h2>
                <div className="space-y-1.5 text-sm">
                  <p className="flex justify-between gap-3"><span className="text-slate-500">Name</span><span className="font-medium text-slate-900 text-right">{quote.clientSnapshot.fullName}</span></p>
                  {quote.clientSnapshot.companyName ? <p className="flex justify-between gap-3"><span className="text-slate-500">Company</span><span className="text-slate-900 text-right">{quote.clientSnapshot.companyName}</span></p> : null}
                  {quote.clientSnapshot.phone ? <p className="flex justify-between gap-3"><span className="text-slate-500">Phone</span><span className="text-slate-900 text-right">{quote.clientSnapshot.phone}</span></p> : null}
                  {quote.clientSnapshot.email ? <p className="flex justify-between gap-3"><span className="text-slate-500">Email</span><span className="text-slate-900 text-right">{quote.clientSnapshot.email}</span></p> : null}
                  {quote.clientSnapshot.address ? <p className="flex justify-between gap-3"><span className="text-slate-500">Address</span><span className="text-slate-900 text-right">{quote.clientSnapshot.address}</span></p> : null}
                </div>
              </article>
            </section>

            <section className="rounded-xl border border-slate-200 p-4 sm:p-5">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-600">Line items</p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-140 border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate-600">
                      <th className="rounded-l-md px-3 py-2">Description</th>
                      <th className="px-3 py-2 text-right">Qty</th>
                      <th className="px-3 py-2 text-right">Unit excl.</th>
                      <th className="px-3 py-2 text-right">Discount</th>
                      <th className="px-3 py-2 text-right">VAT %</th>
                      <th className="rounded-r-md px-3 py-2 text-right">Total HT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quote.lineItems.map((item, index) => {
                      const discountPct = item.discountPercentage ?? 0;
                      const discountAmount = item.discountAmountExcludingTax ?? 0;
                      const vatRate = item.vatRate ?? 0;

                      return (
                        <tr key={item._id ?? `${item.name}-${index}`} className="border-b border-slate-200 last:border-b-0">
                          <td className="px-3 py-2 text-slate-900">{item.name}</td>
                          <td className="px-3 py-2 text-right text-slate-700">{item.quantity}</td>
                          <td className="px-3 py-2 text-right text-slate-700"><PriceDisplay cents={item.unitPriceExcludingTax} locale={locale} /></td>
                          <td className="px-3 py-2 text-right text-slate-700">
                            {discountPct.toFixed(2)}% {discountAmount > 0 ? `(- ${new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(discountAmount / 100)})` : ''}
                          </td>
                          <td className="px-3 py-2 text-right text-slate-700">{vatRate}%</td>
                          <td className="px-3 py-2 text-right font-semibold text-slate-900"><PriceDisplay cents={item.totalExcludingTax} locale={locale} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-5 ml-auto grid w-full max-w-xs gap-2 rounded-lg border border-slate-200 bg-slate-50/50 p-3 text-sm">
                <div className="flex items-center justify-between text-slate-600">
                  <span>Total excl. tax</span>
                  <PriceDisplay cents={quote.totalExcludingTax} locale={locale} />
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Discount</span>
                  <span>- <PriceDisplay cents={totalDiscount} locale={locale} /></span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>VAT</span>
                  <PriceDisplay cents={quote.totalVat} locale={locale} />
                </div>
                <div className="flex items-center justify-between border-t border-slate-300 pt-2 text-base font-semibold text-slate-900">
                  <span>Total incl. tax</span>
                  <PriceDisplay cents={quote.totalIncludingTax} locale={locale} />
                </div>
              </div>

              {quote.notes ? (
                <div className="mt-5 border-t border-border pt-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Notes</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{quote.notes}</p>
                </div>
              ) : null}
            </section>

            <section className="space-y-3 rounded-xl border border-slate-200 p-4 sm:p-5">
              <h2 className="text-base font-semibold text-slate-900">Signature</h2>
              <p className="text-sm text-slate-600">Please draw your signature below to confirm your agreement with this quote.</p>
              <SignatureCanvas onSignatureChange={setSignatureDataUrl} />
            </section>

            <button
              type="button"
              onClick={handleSign}
              disabled={isSigning}
              className="h-12 w-full rounded-md bg-black px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSigning ? 'Submitting signature...' : 'I agree to the terms - Sign this quote'}
            </button>
          </div>
        ) : null}
      </div>
    </main>
  );
}
