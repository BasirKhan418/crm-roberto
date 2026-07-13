'use client';

import { useCallback, useEffect, useState } from 'react';

import type { FinancialAccessScope, MyExpensesTodaySnapshot } from '@/hooks/useFinancialDashboard';

export type SmartAlertExpenseItem = {
  expenseId: string;
  supplierId: string | null;
  supplierName: string;
  amountInclVatCents: number;
  dueDate: string | null;
  paymentStatus: string;
};

export type SmartAlertTicketItem = {
  ticketId: string;
  title: string;
  status: string;
  updatedAt: string | null;
};

export type PotentialDuplicateItem = {
  supplierId: string;
  supplierName: string;
  amountInclVatCents: number;
  expenseIds: string[];
  firstExpenseDate: string | null;
  lastExpenseDate: string | null;
};

export type FinancialSmartAlertsData = {
  scope: FinancialAccessScope;
  alerts: {
    unpaidSupplierInvoices: {
      count: number;
      totalCents: number;
      href: string;
    };
    overdueSupplierInvoices: {
      count: number;
      totalCents: number;
      href: string;
      items: SmartAlertExpenseItem[];
    };
    ticketsWithoutReply48h: {
      count: number;
      href: string;
      items: SmartAlertTicketItem[];
    };
    potentialDuplicateExpenses: {
      count: number;
      href: string;
      items: PotentialDuplicateItem[];
    };
  };
  myExpensesToday: MyExpensesTodaySnapshot;
};

const EMPTY_SMART_ALERTS_DATA: FinancialSmartAlertsData = {
  scope: 'company',
  alerts: {
    unpaidSupplierInvoices: {
      count: 0,
      totalCents: 0,
      href: '/expenses',
    },
    overdueSupplierInvoices: {
      count: 0,
      totalCents: 0,
      href: '/expenses',
      items: [],
    },
    ticketsWithoutReply48h: {
      count: 0,
      href: '/tickets',
      items: [],
    },
    potentialDuplicateExpenses: {
      count: 0,
      href: '/expenses',
      items: [],
    },
  },
  myExpensesToday: {
    expensesEnteredTodayCount: 0,
    expensesEnteredTodayTotalCents: 0,
    supplierInvoicesDueThisWeekCount: 0,
    supplierInvoicesDueThisWeekTotalCents: 0,
    openTicketsAwaitingReplyCount: 0,
  },
};

type SmartAlertsApiPayload = {
  success?: boolean;
  message?: string;
  data?: FinancialSmartAlertsData;
};

function isAbortError(reason: unknown): boolean {
  return reason instanceof DOMException && reason.name === 'AbortError';
}

export function useSmartAlerts() {
  const [data, setData] = useState<FinancialSmartAlertsData>(EMPTY_SMART_ALERTS_DATA);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState<number>(0);

  const refetch = useCallback(() => {
    setReloadTick((previous) => previous + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/dashboard/smart-alerts', {
          signal: controller.signal,
          cache: 'no-store',
        });
        const payload = (await response.json()) as SmartAlertsApiPayload;

        if (!response.ok || !payload.success || !payload.data) {
          setData(EMPTY_SMART_ALERTS_DATA);
          setError(payload.message || 'Could not load smart alerts.');
          return;
        }

        setData(payload.data);
      } catch (caughtError) {
        if (controller.signal.aborted || isAbortError(caughtError)) {
          return;
        }

        setData(EMPTY_SMART_ALERTS_DATA);
        setError('Could not load smart alerts.');
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    load();

    return () => controller.abort();
  }, [reloadTick]);

  return {
    data,
    loading,
    error,
    refetch,
  };
}