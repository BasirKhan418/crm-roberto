'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import type { QuoteListItem } from '@/components/quotes/QuoteTable';

export type QuoteStatusFilter = 'all' | 'pending' | 'draft' | 'sent' | 'accepted' | 'rejected';
export type QuoteSort = 'date' | 'amount';

interface QuotesApiResponse {
  success: boolean;
  message?: string;
  data?: QuoteListItem[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface QuotesPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const initialPagination: QuotesPagination = {
  page: 1,
  limit: 10,
  total: 0,
  totalPages: 0,
};

export function useQuotes(
  filter: QuoteStatusFilter = 'all',
  search = '',
  sort: QuoteSort = 'date',
  page = 1,
  limit = 10
) {
  const [quotes, setQuotes] = useState<QuoteListItem[]>([]);
  const [pagination, setPagination] = useState<QuotesPagination>(initialPagination);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(limit));
    params.set('sort', sort);

    if (filter !== 'all') {
      params.set('status', filter);
    }

    const normalizedSearch = search.trim();
    if (normalizedSearch) {
      params.set('search', normalizedSearch);
    }

    return params.toString();
  }, [filter, search, sort, page, limit]);

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
      setPagination(payload.pagination ?? { ...initialPagination, page, limit });
    } catch (fetchError) {
      setQuotes([]);
      setPagination((prev) => ({ ...prev, total: 0, totalPages: 0 }));
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load quotes');
    } finally {
      setLoading(false);
    }
  }, [query, page, limit]);

  useEffect(() => {
    fetchQuotes();
  }, [fetchQuotes]);

  return {
    quotes,
    pagination,
    loading,
    error,
    refetch: fetchQuotes,
  };
}
