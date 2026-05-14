'use client';

import { useCallback, useEffect, useState } from 'react';

import type { ExpensePaymentStatus, ExpenseStatus } from '@/lib/expenses/constants';

type ExpenseAttachment = {
  _id: string;
  originalName: string;
  displayName: string;
  mimeType: string;
  extension: string;
  sizeBytes: number;
  url: string;
};

type ExpenseDetail = {
  _id: string;
  status: ExpenseStatus;
  paymentStatus: ExpensePaymentStatus;
  amountExclVatCents: number;
  vatAmountCents: number;
  amountInclVatCents: number;
  amountPaidCents: number;
  remainingBalanceCents: number;
  supplierRef?: string | null;
  notes?: string | null;
  expenseDate?: string | null;
  attachments?: ExpenseAttachment[];
};

type ExpenseDetailResponse = {
  success: boolean;
  message?: string;
  data?: ExpenseDetail;
  expense?: ExpenseDetail;
};

export function useExpenseDetail(expenseId?: string) {
  const [expense, setExpense] = useState<ExpenseDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(expenseId));
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!expenseId) {
      setExpense(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/expenses/${expenseId}`, { cache: 'no-store' });
      const payload = (await response.json()) as ExpenseDetailResponse;

      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Failed to load expense');
      }

      setExpense(payload.expense || payload.data || null);
    } catch (fetchError) {
      setExpense(null);
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load expense');
    } finally {
      setLoading(false);
    }
  }, [expenseId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return {
    expense,
    loading,
    error,
    refetch,
  };
}
