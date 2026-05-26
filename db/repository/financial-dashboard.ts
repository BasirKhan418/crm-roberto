import mongoose from "mongoose";

import ConnectDb from "@/db/connectDb";
import Expense from "@/db/models/Expense";
import ExpenseCategory from "@/db/models/ExpenseCategory";
import Invoice from "@/db/models/Invoice";
import Payment from "@/db/models/Payment";
import Supplier from "@/db/models/Supplier";
import User from "@/db/models/User";
import { getMyTicketSummary, listTicketsWithoutReplyForReminder } from "@/db/repository/ticket";
import {
  buildRollingMonthRanges,
  resolveFinancialPeriod,
  type FinancialPeriodRange,
  type FinancialPeriodSelection,
} from "@/lib/financial-periods";
import { hasPermission, normalizeRole } from "@/lib/permissions";

type RepositoryErrorResult = {
  success: false;
  status: number;
  message: string;
};

type RepositorySuccessResult<T> = {
  success: true;
  data: T;
};

type RepositoryResult<T> = RepositoryErrorResult | RepositorySuccessResult<T>;

type FinancialAccessScope = "company" | "own";

type FinancialAccessContext = {
  companyId: string;
  companyObjectId: mongoose.Types.ObjectId;
  userId: string;
  userObjectId: mongoose.Types.ObjectId;
  role: string;
  scope: FinancialAccessScope;
  scopedUserIds: string[];
  scopedUserObjectIds: mongoose.Types.ObjectId[];
};

type FinancialMetrics = {
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

type CategorySpendPoint = {
  categoryId: string | null;
  label: string;
  totalCents: number;
  count: number;
};

type SupplierSpendPoint = {
  supplierId: string;
  label: string;
  totalCents: number;
  count: number;
};

type MonthlyTrendPoint = {
  key: string;
  label: string;
  expensesExclVatCents: number;
  revenueExclVatCents: number;
  expensesVatCents: number;
  revenueVatCents: number;
  grossProfitCents: number;
};

type PeriodComparisonPoint = {
  key: "revenue" | "expenses" | "gross_profit" | "vat_balance";
  label: string;
  currentCents: number;
  previousCents: number;
  deltaCents: number;
  deltaPercent: number | null;
};

type SmartAlertExpenseItem = {
  expenseId: string;
  supplierId: string | null;
  supplierName: string;
  amountInclVatCents: number;
  dueDate: string | null;
  paymentStatus: string;
};

type SmartAlertTicketItem = {
  ticketId: string;
  title: string;
  status: string;
  updatedAt: string | null;
};

type PotentialDuplicateItem = {
  supplierId: string;
  supplierName: string;
  amountInclVatCents: number;
  expenseIds: string[];
  firstExpenseDate: string | null;
  lastExpenseDate: string | null;
};

type SmartAlerts = {
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

type MyExpensesToday = {
  expensesEnteredTodayCount: number;
  expensesEnteredTodayTotalCents: number;
  supplierInvoicesDueThisWeekCount: number;
  supplierInvoicesDueThisWeekTotalCents: number;
  openTicketsAwaitingReplyCount: number;
};

export type FinancialDashboardData = {
  scope: FinancialAccessScope;
  period: {
    kind: FinancialPeriodRange["kind"];
    label: string;
    startDate: string;
    endDateExclusive: string;
    previousStartDate: string;
    previousEndDateExclusive: string;
  };
  metrics: FinancialMetrics;
  charts: {
    expensesByCategory: CategorySpendPoint[];
    monthlyTrend: MonthlyTrendPoint[];
    currentPeriodVsPreviousPeriod: PeriodComparisonPoint[];
    topSuppliersBySpend: SupplierSpendPoint[];
  };
  myExpensesToday: MyExpensesToday;
};

export type FinancialSmartAlertsData = {
  scope: FinancialAccessScope;
  alerts: SmartAlerts;
  myExpensesToday: MyExpensesToday;
};

type InvoiceSummary = {
  _id: mongoose.Types.ObjectId;
  totalExcludingTax?: number;
  totalVat?: number;
  totalIncludingTax?: number;
  status?: string;
};

type ExpenseLabelMap = Map<string, string>;

const COMPANY_WIDE_FINANCIAL_ROLES = new Set([
  "super_admin",
  "administrator",
  "manager",
  "secretary",
  "read_only",
]);

const UNPAID_EXPENSE_STATUSES = ["unpaid", "partial"];
const ISSUED_INVOICE_STATUSES = ["unpaid", "partial_paid", "paid", "overdue"];
const UNPAID_INVOICE_STATUSES = ["unpaid", "partial_paid", "overdue"];

function isValidObjectId(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  return mongoose.Types.ObjectId.isValid(value);
}

function toObjectId(value: string) {
  return new mongoose.Types.ObjectId(value);
}

function toCents(value: unknown) {
  return Math.max(0, Math.round(Number(value) || 0));
}

function toIsoStringOrNull(value: unknown) {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(String(value));
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

function toDateParam(value: Date) {
  return value.toISOString().slice(0, 10);
}

function buildExpenseOutstandingCentsExpression() {
  return {
    $let: {
      vars: {
        remainingCents: {
          $subtract: [
            { $ifNull: ["$amountInclVatCents", 0] },
            { $ifNull: ["$amountPaidCents", 0] },
          ],
        },
      },
      in: {
        $cond: [{ $gt: ["$$remainingCents", 0] }, "$$remainingCents", 0],
      },
    },
  };
}

function calculateDeltaPercent(currentCents: number, previousCents: number) {
  if (previousCents === 0) {
    if (currentCents === 0) return 0;
    return null;
  }

  return Number((((currentCents - previousCents) / previousCents) * 100).toFixed(2));
}

function getUtcTodayStart(now: Date) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
}

function getUtcWeekEndExclusive(now: Date) {
  const todayStart = getUtcTodayStart(now);
  const dayOfWeek = todayStart.getUTCDay();
  const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
  const nextMonday = new Date(todayStart);
  nextMonday.setUTCDate(nextMonday.getUTCDate() + daysUntilMonday);
  return nextMonday;
}

async function resolveFinancialAccessContext(params: {
  companyId?: string | null;
  userId: string;
  role?: string | null;
  allowExternalAccountant?: boolean;
}): Promise<RepositoryResult<FinancialAccessContext>> {
  await ConnectDb();

  if (!isValidObjectId(params.userId)) {
    return { success: false, status: 401, message: "Unauthorized" };
  }

  if (!isValidObjectId(params.companyId ?? null)) {
    return { success: false, status: 400, message: "Missing company context" };
  }

  const normalizedRole = normalizeRole(params.role);
  const isExternalAccountantPortal =
    params.allowExternalAccountant === true && normalizedRole === "external_accountant";

  if (!isExternalAccountantPortal && !hasPermission(normalizedRole, "expenses.view")) {
    return { success: false, status: 403, message: "Forbidden" };
  }

  const scope: FinancialAccessScope = isExternalAccountantPortal
    ? "company"
    : COMPANY_WIDE_FINANCIAL_ROLES.has(normalizedRole)
      ? "company"
      : "own";
  const companyId = String(params.companyId);
  const userId = String(params.userId);

  let scopedUserIds = [userId];

  if (scope === "company") {
    const companyUsers = await User.find({ companyId: toObjectId(companyId) }).distinct("_id");
    scopedUserIds = companyUsers.map((value) => String(value)).filter((value) => isValidObjectId(value));

    if (scopedUserIds.length === 0) {
      scopedUserIds = [userId];
    }
  }

  return {
    success: true,
    data: {
      companyId,
      companyObjectId: toObjectId(companyId),
      userId,
      userObjectId: toObjectId(userId),
      role: normalizedRole,
      scope,
      scopedUserIds,
      scopedUserObjectIds: scopedUserIds.map((value) => toObjectId(value)),
    },
  };
}

function buildExpenseBaseQuery(context: FinancialAccessContext) {
  const query: Record<string, unknown> = {
    companyId: context.companyObjectId,
    archivedAt: null,
    deletedAt: null,
  };

  if (context.scope === "own") {
    query.createdBy = context.userObjectId;
  }

  return query;
}

function buildActiveExpenseQuery(context: FinancialAccessContext, range?: { startDate: Date; endDateExclusive: Date }) {
  const query: Record<string, unknown> = {
    ...buildExpenseBaseQuery(context),
    status: "active",
  };

  if (range) {
    query.expenseDate = {
      $gte: range.startDate,
      $lt: range.endDateExclusive,
    };
  }

  return query;
}

function buildInvoiceBaseQuery(context: FinancialAccessContext) {
  return {
    userId: { $in: context.scopedUserObjectIds },
    status: { $in: ISSUED_INVOICE_STATUSES },
  };
}

function buildInvoiceRangeQuery(context: FinancialAccessContext, range: { startDate: Date; endDateExclusive: Date }) {
  return {
    ...buildInvoiceBaseQuery(context),
    date: {
      $gte: range.startDate,
      $lt: range.endDateExclusive,
    },
  };
}

async function getInvoicePaymentTotals(invoiceIds: mongoose.Types.ObjectId[]) {
  if (invoiceIds.length === 0) {
    return new Map<string, number>();
  }

  const rows = await Payment.aggregate<{
    _id: mongoose.Types.ObjectId;
    totalPaidCents: number;
  }>([
    {
      $match: {
        invoiceId: { $in: invoiceIds },
        status: "succeeded",
      },
    },
    {
      $group: {
        _id: "$invoiceId",
        totalPaidCents: { $sum: "$amount" },
      },
    },
  ]);

  return new Map(rows.map((row) => [String(row._id), toCents(row.totalPaidCents)]));
}

async function buildPeriodMetrics(
  context: FinancialAccessContext,
  range: { startDate: Date; endDateExclusive: Date }
): Promise<FinancialMetrics> {
  const expenseQuery = buildActiveExpenseQuery(context, range);
  const unpaidExpenseQuery = {
    ...expenseQuery,
    paymentStatus: { $in: UNPAID_EXPENSE_STATUSES },
  };
  const invoiceQuery = buildInvoiceRangeQuery(context, range);

  const [expenseRows, unpaidExpenseRows, invoiceRows] = await Promise.all([
    Expense.aggregate<{
      totalExpensesExclVatCents: number;
      totalExpensesVatCents: number;
      totalExpensesInclVatCents: number;
    }>([
      { $match: expenseQuery },
      {
        $group: {
          _id: null,
          totalExpensesExclVatCents: { $sum: "$amountExclVatCents" },
          totalExpensesVatCents: { $sum: "$vatAmountCents" },
          totalExpensesInclVatCents: { $sum: "$amountInclVatCents" },
        },
      },
    ]),
    Expense.aggregate<{
      unpaidPurchaseCount: number;
      unpaidPurchaseTotalCents: number;
    }>([
      { $match: unpaidExpenseQuery },
      {
        $group: {
          _id: null,
          unpaidPurchaseCount: { $sum: 1 },
          unpaidPurchaseTotalCents: { $sum: buildExpenseOutstandingCentsExpression() },
        },
      },
    ]),
    Invoice.find(invoiceQuery)
      .select("_id totalExcludingTax totalVat totalIncludingTax status")
      .lean<InvoiceSummary[]>(),
  ]);

  const invoiceTotals = invoiceRows.reduce(
    (accumulator, row) => {
      accumulator.totalRevenueExclVatCents += toCents(row.totalExcludingTax);
      accumulator.totalRevenueVatCents += toCents(row.totalVat);
      accumulator.totalRevenueInclVatCents += toCents(row.totalIncludingTax);
      return accumulator;
    },
    {
      totalRevenueExclVatCents: 0,
      totalRevenueVatCents: 0,
      totalRevenueInclVatCents: 0,
    }
  );

  const unpaidInvoices = invoiceRows.filter((row) => UNPAID_INVOICE_STATUSES.includes(String(row.status || "")));
  const paymentTotals = await getInvoicePaymentTotals(unpaidInvoices.map((row) => row._id));
  const unpaidSalesTotalCents = unpaidInvoices.reduce((sum, row) => {
    const totalInvoiceCents = toCents(row.totalIncludingTax);
    const paidCents = paymentTotals.get(String(row._id)) ?? 0;
    return sum + Math.max(0, totalInvoiceCents - paidCents);
  }, 0);

  const expenseTotals = expenseRows[0] ?? {
    totalExpensesExclVatCents: 0,
    totalExpensesVatCents: 0,
    totalExpensesInclVatCents: 0,
  };
  const unpaidExpenses = unpaidExpenseRows[0] ?? {
    unpaidPurchaseCount: 0,
    unpaidPurchaseTotalCents: 0,
  };

  const totalExpensesExclVatCents = toCents(expenseTotals.totalExpensesExclVatCents);
  const totalExpensesVatCents = toCents(expenseTotals.totalExpensesVatCents);
  const totalExpensesInclVatCents = toCents(expenseTotals.totalExpensesInclVatCents);
  const totalRevenueExclVatCents = toCents(invoiceTotals.totalRevenueExclVatCents);
  const totalRevenueVatCents = toCents(invoiceTotals.totalRevenueVatCents);
  const totalRevenueInclVatCents = toCents(invoiceTotals.totalRevenueInclVatCents);

  return {
    totalExpensesExclVatCents,
    totalExpensesVatCents,
    totalExpensesInclVatCents,
    totalRevenueExclVatCents,
    totalRevenueVatCents,
    totalRevenueInclVatCents,
    grossProfitCents: totalRevenueExclVatCents - totalExpensesExclVatCents,
    collectedVatCents: totalRevenueVatCents,
    deductibleVatCents: totalExpensesVatCents,
    vatBalanceCents: totalRevenueVatCents - totalExpensesVatCents,
    unpaidPurchaseCount: Number(unpaidExpenses.unpaidPurchaseCount || 0),
    unpaidPurchaseTotalCents: toCents(unpaidExpenses.unpaidPurchaseTotalCents),
    unpaidSalesCount: unpaidInvoices.length,
    unpaidSalesTotalCents,
  };
}

async function buildCategoryLabelMap(categoryIds: string[], companyId: mongoose.Types.ObjectId): Promise<ExpenseLabelMap> {
  if (categoryIds.length === 0) {
    return new Map();
  }

  const rows = await ExpenseCategory.find({
    _id: { $in: categoryIds.map((value) => toObjectId(value)) },
    companyId,
  })
    .select("_id name nameEn nameFr")
    .lean<Array<{ _id: mongoose.Types.ObjectId; name?: string; nameEn?: string; nameFr?: string }>>();

  return new Map(
    rows.map((row) => [String(row._id), row.name?.trim() || row.nameEn?.trim() || row.nameFr?.trim() || "Uncategorized"])
  );
}

async function buildSupplierLabelMap(supplierIds: string[], scopedUserObjectIds: mongoose.Types.ObjectId[]) {
  if (supplierIds.length === 0) {
    return new Map<string, string>();
  }

  const rows = await Supplier.find({
    _id: { $in: supplierIds.map((value) => toObjectId(value)) },
    user: { $in: scopedUserObjectIds },
  })
    .select("_id fullName companyName")
    .lean<Array<{ _id: mongoose.Types.ObjectId; fullName?: string; companyName?: string | null }>>();

  return new Map(
    rows.map((row) => [String(row._id), row.companyName?.trim() || row.fullName?.trim() || "Unknown supplier"])
  );
}

async function buildExpensesByCategory(
  context: FinancialAccessContext,
  range: { startDate: Date; endDateExclusive: Date }
) {
  const rows = await Expense.aggregate<{
    _id: mongoose.Types.ObjectId | null;
    totalCents: number;
    count: number;
  }>([
    { $match: buildActiveExpenseQuery(context, range) },
    {
      $group: {
        _id: "$categoryId",
        totalCents: { $sum: "$amountInclVatCents" },
        count: { $sum: 1 },
      },
    },
    { $sort: { totalCents: -1 } },
  ]);

  const categoryIds = rows.map((row) => String(row._id)).filter((value) => isValidObjectId(value));
  const labelMap = await buildCategoryLabelMap(categoryIds, context.companyObjectId);

  return rows.map((row) => {
    const categoryId = row._id ? String(row._id) : null;
    return {
      categoryId,
      label: categoryId ? labelMap.get(categoryId) || "Uncategorized" : "Uncategorized",
      totalCents: toCents(row.totalCents),
      count: Number(row.count || 0),
    } satisfies CategorySpendPoint;
  });
}

async function buildTopSuppliersBySpend(
  context: FinancialAccessContext,
  range: { startDate: Date; endDateExclusive: Date }
) {
  const rows = await Expense.aggregate<{
    _id: mongoose.Types.ObjectId;
    totalCents: number;
    count: number;
  }>([
    {
      $match: {
        ...buildActiveExpenseQuery(context, range),
        supplierId: { $ne: null },
      },
    },
    {
      $group: {
        _id: "$supplierId",
        totalCents: { $sum: "$amountInclVatCents" },
        count: { $sum: 1 },
      },
    },
    { $sort: { totalCents: -1 } },
    { $limit: 5 },
  ]);

  const supplierIds = rows.map((row) => String(row._id)).filter((value) => isValidObjectId(value));
  const labelMap = await buildSupplierLabelMap(supplierIds, context.scopedUserObjectIds);

  return rows.map((row) => ({
    supplierId: String(row._id),
    label: labelMap.get(String(row._id)) || "Unknown supplier",
    totalCents: toCents(row.totalCents),
    count: Number(row.count || 0),
  })) satisfies SupplierSpendPoint[];
}

async function buildMonthlyTrend(
  context: FinancialAccessContext,
  period: FinancialPeriodRange
) {
  const rollingMonths = buildRollingMonthRanges(period.endDateExclusive, 12);
  const trendStart = rollingMonths[0]?.startDate;
  const trendEnd = rollingMonths[rollingMonths.length - 1]?.endDateExclusive;

  if (!trendStart || !trendEnd) {
    return [] as MonthlyTrendPoint[];
  }

  const [expenseRows, invoiceRows] = await Promise.all([
    Expense.aggregate<{
      _id: { year: number; month: number };
      expensesExclVatCents: number;
      expensesVatCents: number;
    }>([
      {
        $match: buildActiveExpenseQuery(context, {
          startDate: trendStart,
          endDateExclusive: trendEnd,
        }),
      },
      {
        $group: {
          _id: {
            year: { $year: "$expenseDate" },
            month: { $month: "$expenseDate" },
          },
          expensesExclVatCents: { $sum: "$amountExclVatCents" },
          expensesVatCents: { $sum: "$vatAmountCents" },
        },
      },
    ]),
    Invoice.aggregate<{
      _id: { year: number; month: number };
      revenueExclVatCents: number;
      revenueVatCents: number;
    }>([
      {
        $match: buildInvoiceRangeQuery(context, {
          startDate: trendStart,
          endDateExclusive: trendEnd,
        }),
      },
      {
        $group: {
          _id: {
            year: { $year: "$date" },
            month: { $month: "$date" },
          },
          revenueExclVatCents: { $sum: "$totalExcludingTax" },
          revenueVatCents: { $sum: "$totalVat" },
        },
      },
    ]),
  ]);

  const expenseMap = new Map(
    expenseRows.map((row) => [`${row._id.year}-${String(row._id.month).padStart(2, "0")}`, row])
  );
  const invoiceMap = new Map(
    invoiceRows.map((row) => [`${row._id.year}-${String(row._id.month).padStart(2, "0")}`, row])
  );

  return rollingMonths.map((month) => {
    const expenseRow = expenseMap.get(month.key);
    const invoiceRow = invoiceMap.get(month.key);
    const expensesExclVatCents = toCents(expenseRow?.expensesExclVatCents);
    const revenueExclVatCents = toCents(invoiceRow?.revenueExclVatCents);
    const expensesVatCents = toCents(expenseRow?.expensesVatCents);
    const revenueVatCents = toCents(invoiceRow?.revenueVatCents);

    return {
      key: month.key,
      label: month.label,
      expensesExclVatCents,
      revenueExclVatCents,
      expensesVatCents,
      revenueVatCents,
      grossProfitCents: revenueExclVatCents - expensesExclVatCents,
    } satisfies MonthlyTrendPoint;
  });
}

function buildCurrentPeriodComparison(current: FinancialMetrics, previous: FinancialMetrics) {
  const rows: Array<Pick<PeriodComparisonPoint, "key" | "label"> & { currentCents: number; previousCents: number }> = [
    {
      key: "revenue",
      label: "Revenue",
      currentCents: current.totalRevenueExclVatCents,
      previousCents: previous.totalRevenueExclVatCents,
    },
    {
      key: "expenses",
      label: "Expenses",
      currentCents: current.totalExpensesExclVatCents,
      previousCents: previous.totalExpensesExclVatCents,
    },
    {
      key: "gross_profit",
      label: "Gross profit",
      currentCents: current.grossProfitCents,
      previousCents: previous.grossProfitCents,
    },
    {
      key: "vat_balance",
      label: "VAT balance",
      currentCents: current.vatBalanceCents,
      previousCents: previous.vatBalanceCents,
    },
  ];

  return rows.map((row) => ({
    ...row,
    deltaCents: row.currentCents - row.previousCents,
    deltaPercent: calculateDeltaPercent(row.currentCents, row.previousCents),
  })) satisfies PeriodComparisonPoint[];
}

async function buildPotentialDuplicateExpenses(context: FinancialAccessContext) {
  const groupedRows = await Expense.aggregate<{
    _id: {
      supplierId: mongoose.Types.ObjectId;
      amountInclVatCents: number;
    };
    expenseIds: mongoose.Types.ObjectId[];
    count: number;
    latestExpenseDate: Date | null;
  }>([
    {
      $match: {
        ...buildActiveExpenseQuery(context),
        supplierId: { $ne: null },
        expenseDate: { $ne: null },
      },
    },
    {
      $group: {
        _id: {
          supplierId: "$supplierId",
          amountInclVatCents: "$amountInclVatCents",
        },
        expenseIds: { $push: "$_id" },
        count: { $sum: 1 },
        latestExpenseDate: { $max: "$expenseDate" },
      },
    },
    { $match: { count: { $gt: 1 } } },
    { $sort: { latestExpenseDate: -1 } },
    { $limit: 25 },
  ]);

  if (groupedRows.length === 0) {
    return [] as PotentialDuplicateItem[];
  }

  const allExpenseIds = groupedRows.flatMap((row) => row.expenseIds);
  const expenseRows = await Expense.find({ _id: { $in: allExpenseIds } })
    .select("_id supplierId expenseDate amountInclVatCents")
    .lean<Array<{
      _id: mongoose.Types.ObjectId;
      supplierId?: mongoose.Types.ObjectId | null;
      expenseDate?: Date | null;
      amountInclVatCents?: number;
    }>>();

  const expenseMap = new Map(
    expenseRows.map((row) => [String(row._id), row])
  );
  const supplierIds = groupedRows.map((row) => String(row._id.supplierId));
  const supplierLabelMap = await buildSupplierLabelMap(supplierIds, context.scopedUserObjectIds);

  const duplicates: PotentialDuplicateItem[] = [];

  for (const group of groupedRows) {
    const expenses = group.expenseIds
      .map((expenseId) => expenseMap.get(String(expenseId)))
      .filter(
        (row): row is {
          _id: mongoose.Types.ObjectId;
          supplierId?: mongoose.Types.ObjectId | null;
          expenseDate?: Date | null;
          amountInclVatCents?: number;
        } => Boolean(row)
      )
      .filter((row) => row.expenseDate instanceof Date)
      .sort((left, right) => new Date(left.expenseDate || 0).getTime() - new Date(right.expenseDate || 0).getTime());

    const duplicateIds = new Set<string>();

    for (let index = 1; index < expenses.length; index += 1) {
      const previous = expenses[index - 1];
      const current = expenses[index];
      const previousDate = previous.expenseDate instanceof Date ? previous.expenseDate.getTime() : Number.NaN;
      const currentDate = current.expenseDate instanceof Date ? current.expenseDate.getTime() : Number.NaN;

      if (!Number.isFinite(previousDate) || !Number.isFinite(currentDate)) {
        continue;
      }

      const differenceDays = Math.abs(currentDate - previousDate) / (1000 * 60 * 60 * 24);
      if (differenceDays <= 30) {
        duplicateIds.add(String(previous._id));
        duplicateIds.add(String(current._id));
      }
    }

    if (duplicateIds.size === 0) {
      continue;
    }

    const duplicateExpenses = expenses.filter((row) => duplicateIds.has(String(row._id)));
    const firstExpenseDate = duplicateExpenses[0]?.expenseDate ?? null;
    const lastExpenseDate = duplicateExpenses[duplicateExpenses.length - 1]?.expenseDate ?? null;

    duplicates.push({
      supplierId: String(group._id.supplierId),
      supplierName: supplierLabelMap.get(String(group._id.supplierId)) || "Unknown supplier",
      amountInclVatCents: toCents(group._id.amountInclVatCents),
      expenseIds: duplicateExpenses.map((row) => String(row._id)),
      firstExpenseDate: toIsoStringOrNull(firstExpenseDate),
      lastExpenseDate: toIsoStringOrNull(lastExpenseDate),
    });
  }

  return duplicates;
}

async function buildSmartAlerts(context: FinancialAccessContext) {
  const overdueExpenseQuery = {
    ...buildActiveExpenseQuery(context),
    paymentStatus: { $in: UNPAID_EXPENSE_STATUSES },
    dueDate: { $ne: null, $lt: new Date() },
  };
  const unpaidExpenseQuery = {
    ...buildActiveExpenseQuery(context),
    paymentStatus: { $in: UNPAID_EXPENSE_STATUSES },
  };

  const [unpaidTotals, overdueTotals, overdueRows, staleTicketsResult, duplicateItems] = await Promise.all([
    Expense.aggregate<{
      count: number;
      totalCents: number;
    }>([
      { $match: unpaidExpenseQuery },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          totalCents: { $sum: "$amountInclVatCents" },
        },
      },
    ]),
    Expense.aggregate<{
      count: number;
      totalCents: number;
    }>([
      { $match: overdueExpenseQuery },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          totalCents: { $sum: buildExpenseOutstandingCentsExpression() },
        },
      },
    ]),
    Expense.find(overdueExpenseQuery)
      .sort({ dueDate: 1 })
      .limit(5)
      .select("_id supplierId amountInclVatCents dueDate paymentStatus")
      .lean<Array<{
        _id: mongoose.Types.ObjectId;
        supplierId?: mongoose.Types.ObjectId | null;
        amountInclVatCents?: number;
        dueDate?: Date | null;
        paymentStatus?: string;
      }>>(),
    listTicketsWithoutReplyForReminder({
      companyId: context.companyId,
      olderThanHours: 48,
      limit: 5,
    }),
    buildPotentialDuplicateExpenses(context),
  ]);

  const overdueSupplierIds = overdueRows
    .map((row) => (row.supplierId ? String(row.supplierId) : null))
    .filter((value): value is string => Boolean(value));
  const supplierLabelMap = await buildSupplierLabelMap(overdueSupplierIds, context.scopedUserObjectIds);
  const overdueSupplierItems = overdueRows.map((row) => ({
    expenseId: String(row._id),
    supplierId: row.supplierId ? String(row.supplierId) : null,
    supplierName: row.supplierId ? supplierLabelMap.get(String(row.supplierId)) || "Unknown supplier" : "Unknown supplier",
    amountInclVatCents: toCents(row.amountInclVatCents),
    dueDate: toIsoStringOrNull(row.dueDate),
    paymentStatus: String(row.paymentStatus || "unpaid"),
  })) satisfies SmartAlertExpenseItem[];

  const staleTicketItems = staleTicketsResult.success
    ? staleTicketsResult.items.map((item) => ({
        ticketId: String((item as { _id: mongoose.Types.ObjectId })._id),
        title: String((item as { title?: string }).title || "Untitled ticket"),
        status: String((item as { status?: string }).status || "waiting"),
        updatedAt: toIsoStringOrNull((item as { updatedAt?: Date | string | null }).updatedAt),
      }))
    : [];

  const unpaidSupplierSummary = unpaidTotals[0] ?? { count: 0, totalCents: 0 };
  const overdueSupplierSummary = overdueTotals[0] ?? { count: 0, totalCents: 0 };
  const todayParam = toDateParam(getUtcTodayStart(new Date()));

  return {
    unpaidSupplierInvoices: {
      count: Number(unpaidSupplierSummary.count || 0),
      totalCents: toCents(unpaidSupplierSummary.totalCents),
      href: "/expenses?status=active&paymentStatusGroup=open",
    },
    overdueSupplierInvoices: {
      count: Number(overdueSupplierSummary.count || 0),
      totalCents: toCents(overdueSupplierSummary.totalCents),
      href: `/expenses?status=active&paymentStatusGroup=open&dueBefore=${todayParam}&sortBy=dueDate&sortOrder=asc`,
      items: overdueSupplierItems,
    },
    ticketsWithoutReply48h: {
      count: staleTicketsResult.success ? Number((staleTicketsResult as { totalCount?: number }).totalCount || staleTicketItems.length) : 0,
      href: "/tickets?status=waiting",
      items: staleTicketItems,
    },
    potentialDuplicateExpenses: {
      count: duplicateItems.length,
      href: "/expenses?sortBy=expenseDate&sortOrder=desc",
      items: duplicateItems,
    },
  } satisfies SmartAlerts;
}

async function buildMyExpensesToday(context: FinancialAccessContext, now: Date = new Date()) {
  const todayStart = getUtcTodayStart(now);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setUTCDate(tomorrowStart.getUTCDate() + 1);
  const weekEndExclusive = getUtcWeekEndExclusive(now);

  const dueThisWeekQuery: Record<string, unknown> = {
    ...buildActiveExpenseQuery(context),
    paymentStatus: { $in: UNPAID_EXPENSE_STATUSES },
    dueDate: {
      $gte: todayStart,
      $lt: weekEndExclusive,
    },
  };

  const [enteredTodayRows, dueThisWeekRows, ticketSummary] = await Promise.all([
    Expense.aggregate<{
      count: number;
      totalCents: number;
    }>([
      {
        $match: {
          ...buildExpenseBaseQuery(context),
          createdBy: context.userObjectId,
          createdAt: {
            $gte: todayStart,
            $lt: tomorrowStart,
          },
        },
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          totalCents: { $sum: buildExpenseOutstandingCentsExpression() },
        },
      },
    ]),
    Expense.aggregate<{
      count: number;
      totalCents: number;
    }>([
      { $match: dueThisWeekQuery },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          totalCents: { $sum: buildExpenseOutstandingCentsExpression() },
        },
      },
    ]),
    getMyTicketSummary({
      companyId: context.companyId,
      userId: context.userId,
    }),
  ]);

  const enteredToday = enteredTodayRows[0] ?? { count: 0, totalCents: 0 };
  const dueThisWeek = dueThisWeekRows[0] ?? { count: 0, totalCents: 0 };

  return {
    expensesEnteredTodayCount: Number(enteredToday.count || 0),
    expensesEnteredTodayTotalCents: toCents(enteredToday.totalCents),
    supplierInvoicesDueThisWeekCount: Number(dueThisWeek.count || 0),
    supplierInvoicesDueThisWeekTotalCents: toCents(dueThisWeek.totalCents),
    openTicketsAwaitingReplyCount: ticketSummary.success ? Number(ticketSummary.data.waiting || 0) : 0,
  } satisfies MyExpensesToday;
}

export async function getFinancialDashboardData(params: {
  companyId?: string | null;
  userId: string;
  role?: string | null;
  period: FinancialPeriodSelection;
  allowExternalAccountant?: boolean;
}): Promise<RepositoryResult<FinancialDashboardData>> {
  const access = await resolveFinancialAccessContext(params);
  if (!access.success) {
    return access;
  }

  let period: FinancialPeriodRange;

  try {
    period = resolveFinancialPeriod(params.period);
  } catch (error) {
    return {
      success: false,
      status: 400,
      message: error instanceof Error ? error.message : "Invalid financial period",
    };
  }

  const [metrics, previousMetrics, expensesByCategory, monthlyTrend, topSuppliersBySpend, myExpensesToday] =
    await Promise.all([
      buildPeriodMetrics(access.data, {
        startDate: period.startDate,
        endDateExclusive: period.endDateExclusive,
      }),
      buildPeriodMetrics(access.data, {
        startDate: period.previousStartDate,
        endDateExclusive: period.previousEndDateExclusive,
      }),
      buildExpensesByCategory(access.data, {
        startDate: period.startDate,
        endDateExclusive: period.endDateExclusive,
      }),
      buildMonthlyTrend(access.data, period),
      buildTopSuppliersBySpend(access.data, {
        startDate: period.startDate,
        endDateExclusive: period.endDateExclusive,
      }),
      buildMyExpensesToday(access.data),
    ]);

  return {
    success: true,
    data: {
      scope: access.data.scope,
      period: {
        kind: period.kind,
        label: period.label,
        startDate: period.startDate.toISOString(),
        endDateExclusive: period.endDateExclusive.toISOString(),
        previousStartDate: period.previousStartDate.toISOString(),
        previousEndDateExclusive: period.previousEndDateExclusive.toISOString(),
      },
      metrics,
      charts: {
        expensesByCategory,
        monthlyTrend,
        currentPeriodVsPreviousPeriod: buildCurrentPeriodComparison(metrics, previousMetrics),
        topSuppliersBySpend,
      },
      myExpensesToday,
    },
  };
}

export async function getFinancialSmartAlertsData(params: {
  companyId?: string | null;
  userId: string;
  role?: string | null;
  allowExternalAccountant?: boolean;
}): Promise<RepositoryResult<FinancialSmartAlertsData>> {
  const access = await resolveFinancialAccessContext(params);
  if (!access.success) {
    return access;
  }

  const [alerts, myExpensesToday] = await Promise.all([
    buildSmartAlerts(access.data),
    buildMyExpensesToday(access.data),
  ]);

  return {
    success: true,
    data: {
      scope: access.data.scope,
      alerts,
      myExpensesToday,
    },
  };
}