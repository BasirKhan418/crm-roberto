'use client';

import { useCallback, useEffect, useState } from 'react';

import type { ExpensePaymentStatus, ExpenseStatus } from '@/lib/expenses/constants';

export type ExpenseAttachment = {
  _id: string;
  originalName: string;
  displayName: string;
  mimeType: string;
  extension: string;
  sizeBytes: number;
  url: string;
};

export type ExpenseAuditLog = {
  _id: string;
  action: string;
  fieldName?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  performedAt?: string | null;
  source?: string;
  performedBy?:
    | string
    | {
        _id: string;
        name?: string;
        email?: string;
      };
};

export type PopulatedEntity =
  | string
  | {
      _id: string;
      fullName?: string;
      companyName?: string;
      invoiceNumber?: string;
      name?: string;
    }
  | null;

export type ExpenseDetail = {
  _id: string;
  status: ExpenseStatus;
  paymentStatus: ExpensePaymentStatus;
  amountExclVatCents: number;
  vatAmountCents: number;
  amountInclVatCents: number;
  amountPaidCents: number;
  remainingBalanceCents: number;
  vatRate: number;
  paymentMethod?: string | null;
  paidBy?: string | null;
  paidAt?: string | null;
  dueDate?: string | null;
  supplierRef?: string | null;
  expenseType?: string;
  notes?: string | null;
  expenseDate?: string | null;
  projectId?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  createdBy?:
    | string
    | {
        _id: string;
        name?: string;
        email?: string;
      }
    | null;
  updatedBy?:
    | string
    | {
        _id: string;
        name?: string;
        email?: string;
      }
    | null;
  supplierId?: PopulatedEntity;
  categoryId?: PopulatedEntity;
  clientId?: PopulatedEntity;
  invoiceId?: PopulatedEntity;
  attachments?: ExpenseAttachment[];
  linkedTickets?: Array<Record<string, unknown>>;
  auditLogs?: ExpenseAuditLog[];
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
