'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { ExpensePaymentStatus, ExpenseStatus } from '@/lib/expenses/constants';

export type ExpenseListItem = {
  _id: string;
  expenseDate?: string | null;
  supplierRef?: string | null;
  isDuplicate?: boolean;
  duplicatedFromExpenseId?: string | null;
  duplicatedAt?: string | null;
  amountExclVatCents: number;
  vatAmountCents: number;
  amountInclVatCents: number;
  amountPaidCents: number;
  remainingBalanceCents?: number;
  status: ExpenseStatus;
  paymentStatus: ExpensePaymentStatus;
  categoryId?:
    | string
    | null
    | {
        _id: string;
        name?: string;
        nameEn?: string;
        nameFr?: string;
        canonicalKey?: string;
      };
  supplierId?:
    | string
    | null
    | {
        _id: string;
        fullName?: string;
        companyName?: string | null;
      };
  attachmentsCount?: number;
  createdAt: string;
};

export type ExpenseCategoryItem = {
  _id: string;
  name: string;
  nameEn?: string;
  nameFr?: string;
  slug: string;
  canonicalKey?: string;
  isDefault: boolean;
  isEnabled: boolean;
  sortOrder: number;
};

type ExpensesApiResponse = {
  success: boolean;
  message?: string;
  data?: ExpenseListItem[];
  items?: ExpenseListItem[];
  totals?: {
    totalTtcCents?: number;
    totalPaidCents?: number;
    totalRemainingCents?: number;
  };
  categories?: ExpenseCategoryItem[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

type ExpensesFilters = {
  status?: ExpenseStatus;
  paymentStatus?: ExpensePaymentStatus;
  categoryId?: string;
  supplierId?: string;
  periodStart?: string;
  periodEnd?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
  includeTotals?: boolean;
};

type ExpenseTotals = {
  totalTtcCents: number;
  totalPaidCents: number;
  totalRemainingCents: number;
};

const initialPagination = {
  page: 1,
  limit: 10,
  total: 0,
  totalPages: 0,
};

export function useExpenses(filters?: ExpensesFilters) {
  const [expenses, setExpenses] = useState<ExpenseListItem[]>([]);
  const [pagination, setPagination] = useState(initialPagination);
  const [totals, setTotals] = useState<ExpenseTotals | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const activeRequestControllerRef = useRef<AbortController | null>(null);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    params.set('page', String(filters?.page || 1));
    params.set('limit', String(filters?.limit || 10));

    if (filters?.status) params.set('status', filters.status);
    if (filters?.paymentStatus) params.set('paymentStatus', filters.paymentStatus);
    if (filters?.categoryId) params.set('categoryId', filters.categoryId);
    if (filters?.supplierId) params.set('supplierId', filters.supplierId);
    if (filters?.periodStart) params.set('periodStart', filters.periodStart);
    if (filters?.periodEnd) params.set('periodEnd', filters.periodEnd);
    if (filters?.search) params.set('search', filters.search);
    if (filters?.sortBy) params.set('sortBy', filters.sortBy);
    if (filters?.sortOrder) params.set('sortOrder', filters.sortOrder);
    if (filters?.includeTotals) params.set('includeTotals', '1');

    return params.toString();
  }, [filters]);

  const refetch = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    activeRequestControllerRef.current?.abort();
    const requestController = new AbortController();
    activeRequestControllerRef.current = requestController;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/expenses?${query}`, {
        cache: 'no-store',
        signal: requestController.signal,
      });

      if (requestId !== requestIdRef.current) {
        return;
      }

      if (response.status === 404) {
        setExpenses([]);
        setPagination(initialPagination);
        setTotals(null);
        return;
      }

      const payload = (await response.json()) as ExpensesApiResponse;

      if (requestId !== requestIdRef.current) {
        return;
      }

      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Failed to load expenses');
      }

      setExpenses(payload.items || payload.data || []);
      setPagination(payload.pagination || initialPagination);
      setTotals(
        payload.totals
          ? {
              totalTtcCents: Math.max(0, Math.round(payload.totals.totalTtcCents || 0)),
              totalPaidCents: Math.max(0, Math.round(payload.totals.totalPaidCents || 0)),
              totalRemainingCents: Math.max(0, Math.round(payload.totals.totalRemainingCents || 0)),
            }
          : null
      );
    } catch (fetchError) {
      if (requestController.signal.aborted || requestId !== requestIdRef.current) {
        return;
      }

      setExpenses([]);
      setPagination(initialPagination);
      setTotals(null);
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load expenses');
    } finally {
      if (!requestController.signal.aborted && requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [query]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    function handleRefresh() {
      void refetch();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        void refetch();
      }
    }

    window.addEventListener('focus', handleRefresh);
    window.addEventListener('expenses:refresh', handleRefresh as EventListener);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleRefresh);
      window.removeEventListener('expenses:refresh', handleRefresh as EventListener);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refetch]);

  useEffect(
    () => () => {
      activeRequestControllerRef.current?.abort();
    },
    []
  );

  return {
    expenses,
    pagination,
    totals,
    loading,
    error,
    refetch,
  };
}

export function useExpenseCategories() {
  const [categories, setCategories] = useState<ExpenseCategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/expenses/categories', { cache: 'no-store' });

      if (response.status === 404) {
        setCategories([]);
        return;
      }

      const payload = (await response.json()) as ExpensesApiResponse;

      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Failed to load categories');
      }

      setCategories(payload.categories || []);
    } catch (fetchError) {
      setCategories([]);
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return {
    categories,
    loading,
    error,
    refetch,
  };
}
