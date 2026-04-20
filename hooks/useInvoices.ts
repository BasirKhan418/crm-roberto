'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

export type InvoiceStatus = 'unpaid' | 'partial_paid' | 'paid' | 'overdue';
export type InvoiceStatusFilter = 'all' | InvoiceStatus;
export type InvoiceSort = 'date' | 'amount';

export interface InvoiceListItem {
  _id: string;
  invoiceNumber: string;
  quoteId?: string | null;
  quoteNumber?: string | null;
  date: string;
  dueDate?: string | null;
  status: InvoiceStatus;
  totalExcludingTax?: number;
  totalVat?: number;
  totalIncludingTax: number;
  depositPercentage?: number;
  depositAmount?: number | null;
  depositPaidAt?: string | null;
  amountPaid?: number;
  remainingAmount?: number;
  paymentProgressPercent?: number;
  recurrence?: {
    isActive?: boolean;
  };
  reminderState?: {
    level?: number | null;
  };
  clientId: string;
  clientSnapshot: {
    fullName: string;
    email?: string | null;
  };
}

interface InvoicesApiResponse {
  success: boolean;
  message?: string;
  data?: InvoiceListItem[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface InvoicesPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const initialPagination: InvoicesPagination = {
  page: 1,
  limit: 10,
  total: 0,
  totalPages: 0,
};

export function useInvoices(
  filter: InvoiceStatusFilter = 'all',
  search = '',
  sort: InvoiceSort = 'date',
  page = 1,
  limit = 10
) {
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
  const [pagination, setPagination] = useState<InvoicesPagination>(initialPagination);
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

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/invoices?${query}`, { cache: 'no-store' });
      const payload = (await response.json()) as InvoicesApiResponse;

      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Failed to load invoices');
      }

      setInvoices(payload.data ?? []);
      setPagination(payload.pagination ?? { ...initialPagination, page, limit });
    } catch (fetchError) {
      setInvoices([]);
      setPagination((prev) => ({ ...prev, total: 0, totalPages: 0 }));
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }, [query, page, limit]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  return {
    invoices,
    pagination,
    loading,
    error,
    refetch: fetchInvoices,
  };
}
