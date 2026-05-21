'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

export type ExpenseLookupCategory = {
  _id: string;
  name: string;
  slug: string;
  isEnabled?: boolean;
};

export type ExpenseLookupSupplier = {
  _id: string;
  fullName: string;
  companyName?: string | null;
  email?: string | null;
};

export type ExpenseLookupClient = {
  _id: string;
  fullName: string;
  companyName?: string | null;
  email?: string | null;
};

export type ExpenseLookupInvoice = {
  _id: string;
  invoiceNumber?: string;
  date?: string;
  status?: string;
  totalIncludingTax?: number;
  clientSnapshot?: {
    fullName?: string;
    companyName?: string | null;
  };
};

type ExpenseLookupPayload = {
  success: boolean;
  message?: string;
  categories?: ExpenseLookupCategory[];
  suppliers?: ExpenseLookupSupplier[];
  clients?: ExpenseLookupClient[];
  invoices?: ExpenseLookupInvoice[];
};

export function useExpenseLookups(search?: string, limit = 30) {
  const [categories, setCategories] = useState<ExpenseLookupCategory[]>([]);
  const [suppliers, setSuppliers] = useState<ExpenseLookupSupplier[]>([]);
  const [clients, setClients] = useState<ExpenseLookupClient[]>([]);
  const [invoices, setInvoices] = useState<ExpenseLookupInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (search?.trim()) {
      params.set('search', search.trim());
    }
    params.set('limit', String(limit));
    return params.toString();
  }, [limit, search]);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/expenses/lookups?${query}`, { cache: 'no-store' });
      const payload = (await response.json().catch(() => null)) as ExpenseLookupPayload | null;

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || 'Failed to load expense lookups');
      }

      setCategories(payload.categories || []);
      setSuppliers(payload.suppliers || []);
      setClients(payload.clients || []);
      setInvoices(payload.invoices || []);
    } catch (fetchError) {
      setCategories([]);
      setSuppliers([]);
      setClients([]);
      setInvoices([]);
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load expense lookups');
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return {
    categories,
    suppliers,
    clients,
    invoices,
    loading,
    error,
    refetch,
  };
}

export async function createInlineExpenseSupplier(input: {
  fullName: string;
  contactName?: string;
  email?: string;
  phone?: string;
}) {
  const response = await fetch('/api/expenses/lookups', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  const payload = (await response.json().catch(() => null)) as
    | {
        success: boolean;
        message?: string;
        supplier?: ExpenseLookupSupplier;
      }
    | null;

  if (!response.ok || !payload?.success || !payload.supplier) {
    throw new Error(payload?.message || 'Failed to create supplier');
  }

  return payload.supplier;
}

export async function createInlineExpenseCategory(input: {
  name: string;
  isEnabled?: boolean;
  sortOrder?: number;
}) {
  const response = await fetch('/api/expenses/categories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  const payload = (await response.json().catch(() => null)) as
    | {
        success: boolean;
        message?: string;
        category?: ExpenseLookupCategory;
      }
    | null;

  if (!response.ok || !payload?.success || !payload.category) {
    throw new Error(payload?.message || 'Failed to create category');
  }

  return payload.category;
}
