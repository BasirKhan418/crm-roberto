'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  buildFinancialPeriodSearchParams,
  getDefaultFinancialPeriodSelection,
  type FinancialPeriodKind,
  type FinancialPeriodSelection,
} from '@/lib/financial-periods';

export type FinancialAccessScope = 'company' | 'own';

export type FinancialMetrics = {
  totalExpensesExclVatCents: number;
  totalExpensesVatCents: number;
  totalExpensesInclVatCents: number;
  totalRevenueExclVatCents: number;
  totalRevenueVatCents: number;
  totalRevenueInclVatCents: number;
  grossProfitCents: number;
  collectedVatCents: number;
  deductibleVatCents: number;
  vatBalanceCents: number;
  unpaidPurchaseCount: number;
  unpaidPurchaseTotalCents: number;
  unpaidSalesCount: number;
  unpaidSalesTotalCents: number;
};

export type FinancialCategorySpendPoint = {
  categoryId: string | null;
  label: string;
  totalCents: number;
  count: number;
};

export type FinancialMonthlyTrendPoint = {
  key: string;
  label: string;
  expensesExclVatCents: number;
  revenueExclVatCents: number;
  expensesVatCents: number;
  revenueVatCents: number;
  grossProfitCents: number;
};

export type FinancialComparisonPoint = {
  key: 'revenue' | 'expenses' | 'gross_profit' | 'vat_balance';
  label: string;
  currentCents: number;
  previousCents: number;
  deltaCents: number;
  deltaPercent: number | null;
};

export type FinancialSupplierSpendPoint = {
  supplierId: string;
  label: string;
  totalCents: number;
  count: number;
};

export type MyExpensesTodaySnapshot = {
  expensesEnteredTodayCount: number;
  expensesEnteredTodayTotalCents: number;
  supplierInvoicesDueThisWeekCount: number;
  supplierInvoicesDueThisWeekTotalCents: number;
  openTicketsAwaitingReplyCount: number;
};

export type FinancialDashboardData = {
  scope: FinancialAccessScope;
  period: {
    kind: FinancialPeriodKind;
    label: string;
    startDate: string;
    endDateExclusive: string;
    previousStartDate: string;
    previousEndDateExclusive: string;
  };
  metrics: FinancialMetrics;
  charts: {
    expensesByCategory: FinancialCategorySpendPoint[];
    monthlyTrend: FinancialMonthlyTrendPoint[];
    currentPeriodVsPreviousPeriod: FinancialComparisonPoint[];
    topSuppliersBySpend: FinancialSupplierSpendPoint[];
  };
  myExpensesToday: MyExpensesTodaySnapshot;
};

export const EMPTY_FINANCIAL_DASHBOARD_DATA: FinancialDashboardData = {
  scope: 'company',
  period: {
    kind: 'month',
    label: '',
    startDate: '',
    endDateExclusive: '',
    previousStartDate: '',
    previousEndDateExclusive: '',
  },
  metrics: {
    totalExpensesExclVatCents: 0,
    totalExpensesVatCents: 0,
    totalExpensesInclVatCents: 0,
    totalRevenueExclVatCents: 0,
    totalRevenueVatCents: 0,
    totalRevenueInclVatCents: 0,
    grossProfitCents: 0,
    collectedVatCents: 0,
    deductibleVatCents: 0,
    vatBalanceCents: 0,
    unpaidPurchaseCount: 0,
    unpaidPurchaseTotalCents: 0,
    unpaidSalesCount: 0,
    unpaidSalesTotalCents: 0,
  },
  charts: {
    expensesByCategory: [],
    monthlyTrend: [],
    currentPeriodVsPreviousPeriod: [],
    topSuppliersBySpend: [],
  },
  myExpensesToday: {
    expensesEnteredTodayCount: 0,
    expensesEnteredTodayTotalCents: 0,
    supplierInvoicesDueThisWeekCount: 0,
    supplierInvoicesDueThisWeekTotalCents: 0,
    openTicketsAwaitingReplyCount: 0,
  },
};

type FinancialDashboardApiPayload = {
  success?: boolean;
  message?: string;
  data?: FinancialDashboardData;
};

type UseFinancialDashboardResult = {
  period: FinancialPeriodSelection;
  setPeriod: React.Dispatch<React.SetStateAction<FinancialPeriodSelection>>;
  data: FinancialDashboardData;
  loading: boolean;
  error: string | null;
  refetch: () => void;
};

function isAbortError(reason: unknown): boolean {
  return reason instanceof DOMException && reason.name === 'AbortError';
}

export function useFinancialDashboard(
  initialPeriod: FinancialPeriodSelection = getDefaultFinancialPeriodSelection()
): UseFinancialDashboardResult {
  const [period, setPeriod] = useState<FinancialPeriodSelection>(initialPeriod);
  const [data, setData] = useState<FinancialDashboardData>(EMPTY_FINANCIAL_DASHBOARD_DATA);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState<number>(0);

  const queryString = useMemo(() => buildFinancialPeriodSearchParams(period).toString(), [period]);

  const refetch = useCallback(() => {
    setReloadTick((previous) => previous + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/dashboard/financial?${queryString}`, {
          signal: controller.signal,
          cache: 'no-store',
        });
        const payload = (await response.json()) as FinancialDashboardApiPayload;

        if (!response.ok || !payload.success || !payload.data) {
          setData(EMPTY_FINANCIAL_DASHBOARD_DATA);
          setError(payload.message || 'Could not load financial dashboard data.');
          return;
        }

        setData(payload.data);
      } catch (caughtError) {
        if (controller.signal.aborted || isAbortError(caughtError)) {
          return;
        }

        setData(EMPTY_FINANCIAL_DASHBOARD_DATA);
        setError('Could not load financial dashboard data.');
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    load();

    return () => controller.abort();
  }, [queryString, reloadTick]);

  return {
    period,
    setPeriod,
    data,
    loading,
    error,
    refetch,
  };
}