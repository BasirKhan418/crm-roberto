'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import type { QuoteListItem } from '@/components/quotes/QuoteTable';

export type QuoteStatusFilter = 'all' | 'draft' | 'sent' | 'accepted' | 'refused';
export type QuoteSort = 'date' | 'amount';

interface QuotesApiResponse {
  success: boolean;
  message?: string;
  data?: QuoteListItem[];
}

export function useQuotes(filter: QuoteStatusFilter = 'all', search = '', sort: QuoteSort = 'date') {
  const [quotes, setQuotes] = useState<QuoteListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    params.set('sort', sort);

    if (filter !== 'all') {
      params.set('status', filter);
    }

    const normalizedSearch = search.trim();
    if (normalizedSearch) {
      params.set('search', normalizedSearch);
    }

    return params.toString();
  }, [filter, search, sort]);

  const fetchQuotes = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/quotes?${query}`, { cache: 'no-store' });
      const payload = (await response.json()) as QuotesApiResponse;

      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Failed to load quotes');
      }

      setQuotes(payload.data ?? []);
    } catch (fetchError) {
      setQuotes([]);
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load quotes');
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    fetchQuotes();
  }, [fetchQuotes]);

  return {
    quotes,
    loading,
    error,
    refetch: fetchQuotes,
  };
}
