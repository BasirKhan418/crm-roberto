'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

import CrmShell from '@/components/crm-shell';
import { useLocale } from '@/components/providers/locale-provider';
import QuoteForm, { type QuoteFormData } from '../../../../components/quotes/QuoteForm';
import ErrorMessage from '@/components/ui/ErrorMessage';

interface QuoteApiResponse {
  success: boolean;
  message?: string;
  data?: {
    _id: string;
    quoteNumber: string;
    clientId: string;
    date: string;
    notes?: string | null;
    paymentTerms?: string | null;
    validityDays?: number;
    status: 'draft' | 'sent' | 'accepted' | 'refused' | 'rejected';
    lineItems: Array<{
      productId?: string | null;
      productImageUrl?: string | null;
      name: string;
      quantity: number;
      baseUnitPriceExcludingTax: number;
      unitPriceExcludingTax: number;
      discountPercentage: number;
      vatRate: number;
    }>;
  };
}

export default function EditQuotePage() {
  const params = useParams<{ id: string }>();
  const { locale } = useLocale();
  const t = {
    en: {
      shellTitle: 'Edit Quote',
      loadFailed: 'Failed to load quote',
    },
    fr: {
      shellTitle: 'Modifier le devis',
      loadFailed: 'Impossible de charger le devis',
    },
  }[locale];

  const [quote, setQuote] = useState<QuoteFormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!params?.id) {
      return;
    }

    let cancelled = false;

    async function loadQuote() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/quotes/${params.id}`, { cache: 'no-store' });
        const payload = (await response.json()) as QuoteApiResponse;
        if (!response.ok || !payload.success || !payload.data) {
          throw new Error(payload.message || t.loadFailed);
        }

        if (!cancelled) {
          setQuote({
            _id: payload.data._id,
            quoteNumber: payload.data.quoteNumber,
            clientId: payload.data.clientId,
            date: payload.data.date,
            status: payload.data.status,
            notes: payload.data.notes ?? '',
            paymentTerms: payload.data.paymentTerms ?? null,
            validityDays: payload.data.validityDays ?? 30,
            lineItems: payload.data.lineItems.map((item) => {
              const base = item.baseUnitPriceExcludingTax > 0
                ? item.baseUnitPriceExcludingTax
                : item.unitPriceExcludingTax;
              return {
                productId: item.productId ?? null,
                productImageUrl: item.productImageUrl ?? null,
                name: item.name,
                quantity: item.quantity,
                baseUnitPriceExcludingTax: base,
                unitPriceExcludingTax: item.unitPriceExcludingTax,
                discountPercentage: item.discountPercentage ?? 0,
                vatRate: item.vatRate,
              };
            }),
          });
        }
      } catch (fetchError) {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : t.loadFailed);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadQuote();

    return () => {
      cancelled = true;
    };
  }, [params?.id, t.loadFailed]);

  return (
    <CrmShell title={t.shellTitle}>
      {loading ? (
        <div className="space-y-2">
          <div className="h-8 w-52 animate-pulse rounded bg-muted" />
          <div className="h-40 animate-pulse rounded-xl bg-muted" />
        </div>
      ) : null}

      {!loading && error ? <ErrorMessage message={error} /> : null}

      {!loading && !error && quote ? <QuoteForm mode="edit" quote={quote} /> : null}
    </CrmShell>
  );
}
