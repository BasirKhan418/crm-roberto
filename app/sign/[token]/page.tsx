'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';

import SignatureCanvas from '@/components/sign/SignatureCanvas';
import { PriceDisplay } from '@/components/ui/PriceDisplay';

interface SignQuotePayload {
  company?: {
    companyName: string;
    logoUrl: string | null;
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
    unitPriceExcludingTax: number;
    totalExcludingTax: number;
  }>;
  totalExcludingTax: number;
  totalVat: number;
  totalIncludingTax: number;
  notes?: string | null;
}

type SignError = 'not_found' | 'expired' | 'already_signed' | 'unknown';

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
        if (code === 'not_found' || code === 'expired' || code === 'already_signed') {
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

  const handleSign = async () => {
    if (!signatureDataUrl || !token) {
      window.alert('Please draw your signature first');
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
        setError('expired');
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
    <main className="min-h-screen bg-[#f3f4f6] px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-180 rounded-xl border border-border bg-white p-5 shadow-sm sm:p-8">
        {isLoading ? (
          <div className="space-y-3">
            <div className="h-6 w-52 animate-pulse rounded bg-muted" />
            <div className="h-4 w-72 animate-pulse rounded bg-muted" />
          </div>
        ) : error ? (
          renderError()
        ) : signed ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6">
            <h1 className="text-xl font-semibold text-emerald-800">Quote signed. Thank you, {quote?.clientSnapshot.fullName || 'Client'}!</h1>
            <p className="mt-2 text-sm text-emerald-700">Your signature has been recorded successfully.</p>
          </div>
        ) : quote ? (
          <div className="space-y-8">
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
                  <p className="text-sm text-muted-foreground">Issued by</p>
                  <p className="text-base font-semibold">{companyName}</p>
                </div>
              </div>
            </header>

            <section>
              <h1 className="text-2xl font-semibold tracking-tight">Quote {quote.quoteNumber} - Please review and sign</h1>
              <p className="mt-2 text-sm text-muted-foreground">Date: {formattedDate}</p>
            </section>

            <section className="rounded-lg border border-border p-4 sm:p-5">
              <div className="grid gap-1 text-sm text-muted-foreground">
                <p><span className="font-medium text-foreground">Client:</span> {quote.clientSnapshot.fullName}</p>
                {quote.clientSnapshot.companyName ? <p>{quote.clientSnapshot.companyName}</p> : null}
                {quote.clientSnapshot.email ? <p>{quote.clientSnapshot.email}</p> : null}
              </div>

              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-140 border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-2 py-2">Item</th>
                      <th className="px-2 py-2 text-right">Qty</th>
                      <th className="px-2 py-2 text-right">Unit</th>
                      <th className="px-2 py-2 text-right">Line total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quote.lineItems.map((item, index) => (
                      <tr key={item._id ?? `${item.name}-${index}`} className="border-b border-border/70 last:border-b-0">
                        <td className="px-2 py-2 text-foreground">{item.name}</td>
                        <td className="px-2 py-2 text-right">{item.quantity}</td>
                        <td className="px-2 py-2 text-right"><PriceDisplay cents={item.unitPriceExcludingTax} locale={locale} /></td>
                        <td className="px-2 py-2 text-right font-medium"><PriceDisplay cents={item.totalExcludingTax} locale={locale} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-5 ml-auto grid w-full max-w-xs gap-2 text-sm">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <PriceDisplay cents={quote.totalExcludingTax} locale={locale} />
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>VAT</span>
                  <PriceDisplay cents={quote.totalVat} locale={locale} />
                </div>
                <div className="flex items-center justify-between border-t border-border pt-2 text-base font-semibold">
                  <span>Total</span>
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

            <section className="space-y-3">
              <h2 className="text-base font-semibold">Signature</h2>
              <p className="text-sm text-muted-foreground">Please draw your signature below to confirm your agreement with this quote.</p>
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
