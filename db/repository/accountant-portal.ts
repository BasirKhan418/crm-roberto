import mongoose from "mongoose";

import ConnectDb from "@/db/connectDb";
import Company from "@/db/models/Company";
import CompanyProfile from "@/db/models/CompanyProfile";
import Expense from "@/db/models/Expense";
import ExpenseAttachment from "@/db/models/ExpenseAttachment";
import Invoice from "@/db/models/Invoice";
import Payment from "@/db/models/Payment";
import Supplier from "@/db/models/Supplier";
import Ticket from "@/db/models/Ticket";
import User from "@/db/models/User";
import { listExpenses } from "@/db/repository/expense";
import { listExpenseCategories } from "@/db/repository/expenseCategory";
import { createTicket } from "@/db/repository/ticket";
import {
  getFinancialDashboardData,
  type FinancialDashboardData,
} from "@/db/repository/financial-dashboard";
import {
  resolveFinancialPeriod,
  type FinancialPeriodSelection,
} from "@/lib/financial-periods";
import {
  TICKET_ALLOWED_MIME_TYPES,
  isTicketMimeTypeAllowed,
} from "@/lib/tickets/constants";
import { buildAccountantPurchaseAttachmentFileUrl } from "@/lib/storage/private-file-urls";
import type { AccountantPurchaseTicketReason } from "@/lib/tickets/accountant-purchase-ticket";
import type { AccountantSalesTicketReason } from "@/lib/tickets/accountant-sales-ticket";

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

type PortalDashboardData = FinancialDashboardData & {
  openTicketsAssignedCount: number;
};

type AccountantAttachmentItem = {
  id: string;
  displayName: string;
  url: string;
  mimeType: string;
  extension: string;
  sizeBytes: number;
  createdAt: string | null;
};

type AccountantPurchaseInvoiceItem = {
  id: string;
  status: string;
  paymentStatus: string;
  accountantProcessed: boolean;
  expenseDate: string | null;
  dueDate: string | null;
  amountExclVatCents: number;
  vatAmountCents: number;
  amountInclVatCents: number;
  amountPaidCents: number;
  amountRemainingCents: number;
  supplierRef: string | null;
  notes: string | null;
  attachmentsCount: number;
  attachments: AccountantAttachmentItem[];
  supplier: {
    id: string | null;
    fullName: string;
    companyName: string | null;
  } | null;
  category: {
    id: string | null;
    name: string;
    nameEn: string | null;
    nameFr: string | null;
    canonicalKey: string | null;
  } | null;
};

type AccountantPurchaseInvoicesData = {
  items: AccountantPurchaseInvoiceItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  totals?: {
    totalTtcCents: number;
    totalPaidCents: number;
    totalRemainingCents: number;
  };
};

type AccountantPurchaseTicketData = {
  ticketId: string;
  ticket: Record<string, unknown>;
  initialMessage: Record<string, unknown>;
  recipientIds: string[];
};

type AccountantSalesTicketData = AccountantPurchaseTicketData;

type TicketAllowedMimeType =
  (typeof TICKET_ALLOWED_MIME_TYPES)[number];

type AccountantSalesInvoiceItem = {
  id: string;
  invoiceNumber: string;
  clientName: string;
  clientCompanyName: string | null;
  date: string | null;
  dueDate: string | null;
  status: "unpaid" | "partial_paid" | "paid" | "overdue";
  accountantProcessed: boolean;
  totalExcludingTaxCents: number;
  totalVatCents: number;
  totalIncludingTaxCents: number;
  amountPaidCents: number;
  amountRemainingCents: number;
  pdfDownloadUrl: string;
};

type AccountantSalesInvoicesData = {
  items: AccountantSalesInvoiceItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  totals: {
    totalIncludingTaxCents: number;
    totalPaidCents: number;
    totalRemainingCents: number;
  };
};

type AccountantLookupsData = {
  suppliers: Array<{
    id: string;
    fullName: string;
    companyName: string | null;
    email: string | null;
  }>;
  categories: Array<{
    id: string;
    name: string;
    nameEn: string | null;
    nameFr: string | null;
    canonicalKey: string | null;
  }>;
};

type AccountantCompanyProfile = {
  companyName?: string | null;
  ownerName?: string | null;
  address?: string | null;
  streetNumber?: string | null;
  streetName?: string | null;
  postalCode?: string | null;
  city?: string | null;
  country?: string | null;
  phone?: string | null;
  businessEmail?: string | null;
  vatNumber?: string | null;
  rcsNumber?: string | null;
  businessAuthorizationNumber?: string | null;
  matriculeNumber?: string | null;
  iban?: string | null;
  bankName?: string | null;
  legalIdentifier?: string | null;
  logoUrl?: string | null;
};

function isValidObjectId(value: string | null | undefined) {
  return Boolean(value && mongoose.Types.ObjectId.isValid(value));
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

function normalizeInvoiceStatus(status: unknown, dueDate: unknown) {
  const normalizedStatus = typeof status === "string" ? status : "unpaid";
  if (normalizedStatus === "paid" || normalizedStatus === "overdue") {
    return normalizedStatus as AccountantSalesInvoiceItem["status"];
  }

  const due = dueDate ? new Date(String(dueDate)) : null;
  if (
    due &&
    Number.isFinite(due.getTime()) &&
    (normalizedStatus === "unpaid" || normalizedStatus === "partial_paid") &&
    due.getTime() < Date.now()
  ) {
    return "overdue";
  }

  if (normalizedStatus === "partial_paid") {
    return "partial_paid";
  }

  return "unpaid";
}

async function getCompanyUserObjectIds(companyId: string) {
  const users = await User.find({ companyId: toObjectId(companyId) })
    .select("_id")
    .lean<Array<{ _id: mongoose.Types.ObjectId }>>();

  return users.map((user) => user._id);
}

async function resolveCompanyProfileByCompanyId(companyId: string) {
  const company = await Company.findById(companyId)
    .select("ownerUserId")
    .lean<{ ownerUserId?: mongoose.Types.ObjectId | null } | null>();

  if (!company?.ownerUserId) {
    return null;
  }

  return CompanyProfile.findOne({ user: company.ownerUserId }).lean<AccountantCompanyProfile | null>();
}

function buildPeriodRange(selection?: FinancialPeriodSelection | null) {
  if (!selection) {
    return null;
  }

  const period = resolveFinancialPeriod(selection);
  return {
    startDate: period.startDate,
    endDate: new Date(period.endDateExclusive.getTime() - 1),
  };
}

export async function getAccountantPortalDashboard(params: {
  companyId: string;
  userId: string;
  period: FinancialPeriodSelection;
}): Promise<RepositoryResult<PortalDashboardData>> {
  const financial = await getFinancialDashboardData({
    companyId: params.companyId,
    userId: params.userId,
    role: "external_accountant",
    period: params.period,
    allowExternalAccountant: true,
  });

  if (!financial.success) {
    return financial;
  }

  await ConnectDb();

  const openTicketsAssignedCount = await Ticket.countDocuments({
    companyId: toObjectId(params.companyId),
    archivedAt: null,
    assignedTo: toObjectId(params.userId),
    status: { $in: ["open", "waiting"] },
  });

  return {
    success: true,
    data: {
      ...financial.data,
      openTicketsAssignedCount,
    },
  };
}

export async function listAccountantPortalLookups(params: {
  companyId: string;
}): Promise<RepositoryResult<AccountantLookupsData>> {
  await ConnectDb();

  if (!isValidObjectId(params.companyId)) {
    return { success: false, status: 400, message: "Missing company context" };
  }

  const companyUserIds = await getCompanyUserObjectIds(params.companyId);
  const [categoriesResult, suppliers] = await Promise.all([
    listExpenseCategories(params.companyId, false),
    Supplier.find({ user: { $in: companyUserIds } })
      .select("_id fullName companyName email")
      .sort({ fullName: 1 })
      .lean<Array<{ _id: mongoose.Types.ObjectId; fullName?: string; companyName?: string | null; email?: string | null }>>(),
  ]);

  if (!categoriesResult.success) {
    return { success: false, status: 400, message: categoriesResult.message || "Failed to load lookups" };
  }

  return {
    success: true,
    data: {
      suppliers: suppliers.map((supplier) => ({
        id: String(supplier._id),
        fullName: String(supplier.fullName || supplier.companyName || "Unknown supplier"),
        companyName: supplier.companyName ?? null,
        email: supplier.email ?? null,
      })),
      categories: categoriesResult.categories.map((category) => ({
        id: String(category._id),
        name: String(category.name || category.nameEn || category.nameFr || "Uncategorized"),
        nameEn: typeof category.nameEn === "string" ? category.nameEn : null,
        nameFr: typeof category.nameFr === "string" ? category.nameFr : null,
        canonicalKey: typeof category.canonicalKey === "string" ? category.canonicalKey : null,
      })),
    },
  };
}

export async function listAccountantPurchaseInvoices(params: {
  companyId: string;
  page: number;
  limit: number;
  search?: string;
  sortBy?: "expenseDate" | "amountInclVatCents" | "supplierRef" | "status" | "createdAt";
  sortOrder?: "asc" | "desc";
  paymentStatus?: string;
  supplierId?: string;
  categoryId?: string;
  period?: FinancialPeriodSelection | null;
}): Promise<RepositoryResult<AccountantPurchaseInvoicesData>> {
  if (!isValidObjectId(params.companyId)) {
    return { success: false, status: 400, message: "Missing company context" };
  }

  const periodRange = buildPeriodRange(params.period);
  const result = await listExpenses({
    companyId: params.companyId,
    options: {
      page: params.page,
      limit: params.limit,
      search: params.search || "",
      sortBy: params.sortBy || "expenseDate",
      sortOrder: params.sortOrder || "desc",
    },
    filters: {
      status: "active",
      paymentStatus: params.paymentStatus as "unpaid" | "partial" | "paid" | undefined,
      supplierId: params.supplierId,
      categoryId: params.categoryId,
      periodStart: periodRange?.startDate,
      periodEnd: periodRange?.endDate,
    },
    includeTotals: true,
  });

  const expenseIds = result.items
    .map((item) => String((item as { _id?: unknown })._id || ""))
    .filter((value) => isValidObjectId(value));

  await ConnectDb();

  const attachments = expenseIds.length > 0
    ? await ExpenseAttachment.find({
        companyId: toObjectId(params.companyId),
        expenseId: { $in: expenseIds.map((value) => toObjectId(value)) },
      })
        .select("_id expenseId displayName url mimeType extension sizeBytes createdAt")
        .sort({ createdAt: -1 })
        .lean<Array<{
          _id: mongoose.Types.ObjectId;
          expenseId: mongoose.Types.ObjectId;
          displayName?: string;
          url?: string;
          mimeType?: string;
          extension?: string;
          sizeBytes?: number;
          createdAt?: Date | null;
        }>>()
    : [];

  const attachmentsByExpenseId = new Map<string, AccountantAttachmentItem[]>();

  for (const attachment of attachments) {
    const expenseId = String(attachment.expenseId);
    const list = attachmentsByExpenseId.get(expenseId) || [];
    list.push({
      id: String(attachment._id),
      displayName: String(attachment.displayName || "Attachment"),
      url: buildAccountantPurchaseAttachmentFileUrl(String(attachment._id)),
      mimeType: String(attachment.mimeType || "application/octet-stream"),
      extension: String(attachment.extension || "file"),
      sizeBytes: Math.max(0, Number(attachment.sizeBytes || 0)),
      createdAt: toIsoStringOrNull(attachment.createdAt),
    });
    attachmentsByExpenseId.set(expenseId, list);
  }

  const items = result.items.map((item) => {
    const expense = item as {
      _id: mongoose.Types.ObjectId;
      status?: string;
      paymentStatus?: string;
      accountantProcessed?: boolean;
      expenseDate?: Date | null;
      dueDate?: Date | null;
      amountExclVatCents?: number;
      vatAmountCents?: number;
      amountInclVatCents?: number;
      amountPaidCents?: number;
      supplierRef?: string | null;
      notes?: string | null;
      attachmentsCount?: number;
      supplierId?: { _id?: mongoose.Types.ObjectId; fullName?: string; companyName?: string | null } | null;
      categoryId?: {
        _id?: mongoose.Types.ObjectId;
        name?: string;
        nameEn?: string | null;
        nameFr?: string | null;
        canonicalKey?: string | null;
      } | null;
    };
    const normalizedAttachments = attachmentsByExpenseId.get(String(expense._id)) || [];
    const amountInclVatCents = toCents(expense.amountInclVatCents);
    const amountPaidCents = toCents(expense.amountPaidCents);

    return {
      id: String(expense._id),
      status: String(expense.status || "active"),
      paymentStatus: String(expense.paymentStatus || "unpaid"),
      accountantProcessed: Boolean(expense.accountantProcessed),
      expenseDate: toIsoStringOrNull(expense.expenseDate),
      dueDate: toIsoStringOrNull(expense.dueDate),
      amountExclVatCents: toCents(expense.amountExclVatCents),
      vatAmountCents: toCents(expense.vatAmountCents),
      amountInclVatCents,
      amountPaidCents,
      amountRemainingCents: Math.max(0, amountInclVatCents - amountPaidCents),
      supplierRef: expense.supplierRef ?? null,
      notes: expense.notes ?? null,
      attachmentsCount: Math.max(Number(expense.attachmentsCount || normalizedAttachments.length), normalizedAttachments.length),
      attachments: normalizedAttachments,
      supplier: expense.supplierId
        ? {
            id: expense.supplierId._id ? String(expense.supplierId._id) : null,
            fullName: String(expense.supplierId.fullName || expense.supplierId.companyName || "Unknown supplier"),
            companyName: expense.supplierId.companyName ?? null,
          }
        : null,
      category: expense.categoryId
        ? {
            id: expense.categoryId._id ? String(expense.categoryId._id) : null,
            name: String(expense.categoryId.name || expense.categoryId.nameEn || expense.categoryId.nameFr || "Uncategorized"),
            nameEn: expense.categoryId.nameEn ?? null,
            nameFr: expense.categoryId.nameFr ?? null,
            canonicalKey: expense.categoryId.canonicalKey ?? null,
          }
        : null,
    } satisfies AccountantPurchaseInvoiceItem;
  });

  return {
    success: true,
    data: {
      items,
      pagination: result.pagination,
      totals: result.totals,
    },
  };
}

export async function listAccountantSalesInvoices(params: {
  companyId: string;
  page: number;
  limit: number;
  search?: string;
  status?: "unpaid" | "partial_paid" | "paid" | "overdue";
  sortBy?: "date" | "dueDate" | "invoiceNumber" | "totalIncludingTax" | "status";
  sortOrder?: "asc" | "desc";
  period?: FinancialPeriodSelection | null;
}): Promise<RepositoryResult<AccountantSalesInvoicesData>> {
  await ConnectDb();

  if (!isValidObjectId(params.companyId)) {
    return { success: false, status: 400, message: "Missing company context" };
  }

  const companyUserIds = await getCompanyUserObjectIds(params.companyId);
  const direction: 1 | -1 = params.sortOrder === "asc" ? 1 : -1;
  const sortBy = params.sortBy || "date";
  const page = Math.max(1, params.page);
  const limit = Math.max(1, Math.min(100, params.limit));
  const skip = (page - 1) * limit;
  const periodRange = params.period ? resolveFinancialPeriod(params.period) : null;

  const query: Record<string, unknown> = {
    userId: { $in: companyUserIds },
  };

  if (periodRange) {
    query.date = {
      $gte: periodRange.startDate,
      $lt: periodRange.endDateExclusive,
    };
  }

  if (params.status) {
    if (params.status === "overdue") {
      query.$or = [
        { status: "overdue" },
        {
          status: { $in: ["unpaid", "partial_paid"] },
          dueDate: { $lt: new Date() },
        },
      ];
    } else {
      query.status = params.status;
    }
  }

  if (params.search) {
    const escaped = params.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    query.$and = [
      ...((query.$and as unknown[] | undefined) ?? []),
      {
        $or: [
          { invoiceNumber: { $regex: escaped, $options: "i" } },
          { "clientSnapshot.fullName": { $regex: escaped, $options: "i" } },
          { "clientSnapshot.companyName": { $regex: escaped, $options: "i" } },
        ],
      },
    ];
  }

  const [items, total] = await Promise.all([
    Invoice.find(query)
      .select("_id invoiceNumber date dueDate status accountantProcessed totalExcludingTax totalVat totalIncludingTax clientSnapshot")
      .sort({ [sortBy]: direction })
      .skip(skip)
      .limit(limit)
      .lean<Array<{
        _id: mongoose.Types.ObjectId;
        invoiceNumber: string;
        date?: Date | null;
        dueDate?: Date | null;
        status?: string;
        accountantProcessed?: boolean;
        totalExcludingTax?: number;
        totalVat?: number;
        totalIncludingTax?: number;
        clientSnapshot?: { fullName?: string; companyName?: string | null };
      }>>(),
    Invoice.countDocuments(query),
  ]);

  const invoiceIds = items.map((invoice) => invoice._id);
  const payments = invoiceIds.length > 0
    ? await Payment.aggregate<{ _id: mongoose.Types.ObjectId; totalPaidCents: number }>([
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
      ])
    : [];

  const paidByInvoiceId = new Map(payments.map((payment) => [String(payment._id), toCents(payment.totalPaidCents)]));

  const normalizedItems = items.map((invoice) => {
    const amountPaidCents = paidByInvoiceId.get(String(invoice._id)) || 0;
    const totalIncludingTaxCents = toCents(invoice.totalIncludingTax);

    return {
      id: String(invoice._id),
      invoiceNumber: invoice.invoiceNumber,
      clientName: String(invoice.clientSnapshot?.fullName || invoice.clientSnapshot?.companyName || "Unknown client"),
      clientCompanyName: invoice.clientSnapshot?.companyName ?? null,
      date: toIsoStringOrNull(invoice.date),
      dueDate: toIsoStringOrNull(invoice.dueDate),
      status: normalizeInvoiceStatus(invoice.status, invoice.dueDate),
      accountantProcessed: Boolean(invoice.accountantProcessed),
      totalExcludingTaxCents: toCents(invoice.totalExcludingTax),
      totalVatCents: toCents(invoice.totalVat),
      totalIncludingTaxCents,
      amountPaidCents,
      amountRemainingCents: Math.max(0, totalIncludingTaxCents - amountPaidCents),
      pdfDownloadUrl: `/api/accountant/sales-invoices/${String(invoice._id)}/pdf`,
    } satisfies AccountantSalesInvoiceItem;
  });

  const totals = normalizedItems.reduce(
    (accumulator, item) => ({
      totalIncludingTaxCents: accumulator.totalIncludingTaxCents + item.totalIncludingTaxCents,
      totalPaidCents: accumulator.totalPaidCents + item.amountPaidCents,
      totalRemainingCents: accumulator.totalRemainingCents + item.amountRemainingCents,
    }),
    {
      totalIncludingTaxCents: 0,
      totalPaidCents: 0,
      totalRemainingCents: 0,
    }
  );

  return {
    success: true,
    data: {
      items: normalizedItems,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
      totals,
    },
  };
}

export async function updateAccountantPurchaseInvoiceProcessed(params: {
  companyId: string;
  expenseId: string;
  processed: boolean;
}): Promise<RepositoryResult<{ id: string; accountantProcessed: boolean }>> {
  await ConnectDb();

  if (!isValidObjectId(params.companyId) || !isValidObjectId(params.expenseId)) {
    return { success: false, status: 400, message: "Invalid purchase invoice context" };
  }

  const updated = await Expense.findOneAndUpdate(
    {
      _id: toObjectId(params.expenseId),
      companyId: toObjectId(params.companyId),
      deletedAt: null,
      archivedAt: null,
      status: "active",
    },
    {
      $set: {
        accountantProcessed: params.processed,
      },
    },
    {
      new: true,
      projection: { _id: 1, accountantProcessed: 1 },
    }
  ).lean<{ _id: mongoose.Types.ObjectId; accountantProcessed?: boolean } | null>();

  if (!updated) {
    return { success: false, status: 404, message: "Purchase invoice not found" };
  }

  return {
    success: true,
    data: {
      id: String(updated._id),
      accountantProcessed: Boolean(updated.accountantProcessed),
    },
  };
}

export async function updateAccountantSalesInvoiceProcessed(params: {
  companyId: string;
  invoiceId: string;
  processed: boolean;
}): Promise<RepositoryResult<{ id: string; accountantProcessed: boolean }>> {
  await ConnectDb();

  if (!isValidObjectId(params.companyId) || !isValidObjectId(params.invoiceId)) {
    return { success: false, status: 400, message: "Invalid sales invoice context" };
  }

  const companyUserIds = await getCompanyUserObjectIds(params.companyId);

  const updated = await Invoice.findOneAndUpdate(
    {
      _id: toObjectId(params.invoiceId),
      userId: { $in: companyUserIds },
    },
    {
      $set: {
        accountantProcessed: params.processed,
      },
    },
    {
      new: true,
      projection: { _id: 1, accountantProcessed: 1 },
    }
  ).lean<{ _id: mongoose.Types.ObjectId; accountantProcessed?: boolean } | null>();

  if (!updated) {
    return { success: false, status: 404, message: "Sales invoice not found" };
  }

  return {
    success: true,
    data: {
      id: String(updated._id),
      accountantProcessed: Boolean(updated.accountantProcessed),
    },
  };
}

export async function getAccountantSalesInvoicePdfData(params: {
  companyId: string;
  invoiceId: string;
}): Promise<RepositoryResult<{
  invoice: {
    _id: mongoose.Types.ObjectId;
    invoiceNumber: string;
    quoteNumber?: string | null;
    date: Date;
    dueDate?: Date | null;
    status: string;
    lineItems: Array<{
      name: string;
      quantity: number;
      baseUnitPriceExcludingTax: number;
      discountPercentage: number;
      discountAmountExcludingTax: number;
      vatRate: number;
      totalExcludingTax: number;
      lineType?: string | null;
    }>;
    totalExcludingTax: number;
    totalVat: number;
    totalIncludingTax: number;
    depositPercentage?: number | null;
    notes?: string | null;
    paymentToken?: string | null;
    paymentTokenExpiry?: Date | null;
    clientSnapshot: unknown;
  };
  payments: Array<{
    amount: number;
    method?: string | null;
    type?: string | null;
    paidAt?: Date | null;
    createdAt?: Date | null;
  }>;
  profile: AccountantCompanyProfile | null;
}>> {
  await ConnectDb();

  if (!isValidObjectId(params.companyId) || !isValidObjectId(params.invoiceId)) {
    return { success: false, status: 400, message: "Invalid invoice context" };
  }

  const companyUserIds = await getCompanyUserObjectIds(params.companyId);
  const invoice = await Invoice.findOne({
    _id: toObjectId(params.invoiceId),
    userId: { $in: companyUserIds },
  })
    .select(
      "_id invoiceNumber quoteNumber date dueDate status lineItems totalExcludingTax totalVat totalIncludingTax depositPercentage notes paymentToken paymentTokenExpiry clientSnapshot"
    )
    .lean<{
      _id: mongoose.Types.ObjectId;
      invoiceNumber: string;
      quoteNumber?: string | null;
      date: Date;
      dueDate?: Date | null;
      status: string;
      lineItems: Array<{
        name: string;
        quantity: number;
        baseUnitPriceExcludingTax: number;
        discountPercentage: number;
        discountAmountExcludingTax: number;
        vatRate: number;
        totalExcludingTax: number;
        lineType?: string | null;
      }>;
      totalExcludingTax: number;
      totalVat: number;
      totalIncludingTax: number;
      depositPercentage?: number | null;
      notes?: string | null;
      paymentToken?: string | null;
      paymentTokenExpiry?: Date | null;
      clientSnapshot: unknown;
    } | null>();

  if (!invoice) {
    return { success: false, status: 404, message: "Invoice not found" };
  }

  const [payments, profile] = await Promise.all([
    Payment.find({
      invoiceId: invoice._id,
      status: "succeeded",
    })
      .sort({ paidAt: -1, createdAt: -1 })
      .select("amount method type paidAt createdAt")
      .lean<Array<{
        amount: number;
        method?: string | null;
        type?: string | null;
        paidAt?: Date | null;
        createdAt?: Date | null;
      }>>(),
    resolveCompanyProfileByCompanyId(params.companyId),
  ]);

  return {
    success: true,
    data: {
      invoice,
      payments,
      profile,
    },
  };
}

function formatPortalMoney(cents: number, locale: "en" | "fr") {
  return new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-GB", {
    style: "currency",
    currency: "EUR",
  }).format(Math.max(0, cents) / 100);
}

function formatPortalDate(value: unknown, locale: "en" | "fr") {
  const isoValue = toIsoStringOrNull(value);
  if (!isoValue) {
    return locale === "fr" ? "-" : "-";
  }

  return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(isoValue));
}

function uniqueIds(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function isPortalTicketMimeType(value: unknown): value is TicketAllowedMimeType {
  return typeof value === "string" && isTicketMimeTypeAllowed(value);
}

function normalizePurchaseTicketReason(reason: AccountantPurchaseTicketReason, locale: "en" | "fr") {
  const copy = {
    en: {
      missing_invoice: {
        title: "Missing invoice",
        prompt: "Please upload the missing invoice for this purchase so accounting can complete the review.",
        type: "document",
      },
      need_clarification: {
        title: "Need clarification",
        prompt: "Please clarify the business context and any missing details for this purchase.",
        type: "validation",
      },
      wrong_vat: {
        title: "Wrong VAT",
        prompt: "Please review the VAT treatment on this purchase and confirm the correct amount or rate.",
        type: "accounting",
      },
      need_supporting_document: {
        title: "Need supporting document",
        prompt: "Please add the supporting document needed to finalize the accounting review for this purchase.",
        type: "document",
      },
    },
    fr: {
      missing_invoice: {
        title: "Facture manquante",
        prompt: "Veuillez televerser la facture manquante pour cette depense afin que la comptabilite puisse terminer la revue.",
        type: "document",
      },
      need_clarification: {
        title: "Besoin de clarification",
        prompt: "Veuillez preciser le contexte metier et les informations manquantes pour cette depense.",
        type: "validation",
      },
      wrong_vat: {
        title: "TVA incorrecte",
        prompt: "Veuillez verifier le traitement TVA de cette depense et confirmer le bon montant ou taux.",
        type: "accounting",
      },
      need_supporting_document: {
        title: "Document justificatif requis",
        prompt: "Veuillez ajouter le document justificatif necessaire pour finaliser la revue comptable de cette depense.",
        type: "document",
      },
    },
  } as const;

  return copy[locale][reason];
}

function normalizeSalesTicketReason(reason: AccountantSalesTicketReason, locale: "en" | "fr") {
  const copy = {
    en: {
      payment_clarification: {
        title: "Payment clarification",
        prompt: "Please clarify the payment situation for this invoice and confirm what has already been received.",
        type: "accounting",
      },
      missing_payment_proof: {
        title: "Missing payment proof",
        prompt: "Please provide the payment proof or transfer confirmation for this invoice.",
        type: "document",
      },
      accounting_question: {
        title: "Accounting question",
        prompt: "Please confirm the accounting treatment or business context for this invoice.",
        type: "validation",
      },
      invoice_dispute: {
        title: "Invoice dispute",
        prompt: "Please explain the dispute on this invoice and share the next action needed to resolve it.",
        type: "dispute",
      },
    },
    fr: {
      payment_clarification: {
        title: "Clarification de paiement",
        prompt: "Veuillez clarifier la situation de paiement de cette facture et confirmer ce qui a deja ete recu.",
        type: "accounting",
      },
      missing_payment_proof: {
        title: "Preuve de paiement manquante",
        prompt: "Veuillez fournir la preuve de paiement ou la confirmation de virement pour cette facture.",
        type: "document",
      },
      accounting_question: {
        title: "Question comptable",
        prompt: "Veuillez confirmer le traitement comptable ou le contexte metier de cette facture.",
        type: "validation",
      },
      invoice_dispute: {
        title: "Litige sur facture",
        prompt: "Veuillez expliquer le litige sur cette facture et partager la prochaine action necessaire pour le resoudre.",
        type: "dispute",
      },
    },
  } as const;

  return copy[locale][reason];
}

async function resolvePortalPurchaseTicketRecipients(params: {
  companyId: string;
  expenseOwnerId?: string | null;
}) {
  const companyUsers = await User.find({
    companyId: toObjectId(params.companyId),
    accessRevokedAt: null,
    account_status: { $ne: "suspended" },
    role: { $ne: "external_accountant" },
  })
    .select("_id role")
    .sort({ role: 1, name: 1, email: 1 })
    .lean<Array<{ _id: mongoose.Types.ObjectId; role?: string | null }>>();

  const ownerId =
    params.expenseOwnerId && companyUsers.some((user) => String(user._id) === params.expenseOwnerId)
      ? params.expenseOwnerId
      : null;

  const adminIds = companyUsers
    .filter((user) => user.role === "administrator")
    .map((user) => String(user._id));

  const fallbackIds = companyUsers.slice(0, 3).map((user) => String(user._id));

  return uniqueIds([ownerId, ...adminIds, ...fallbackIds]);
}

async function resolvePortalInvoiceTicketRecipients(params: {
  companyId: string;
  invoiceOwnerId?: string | null;
}) {
  const companyUsers = await User.find({
    companyId: toObjectId(params.companyId),
    accessRevokedAt: null,
    account_status: { $ne: "suspended" },
    role: { $ne: "external_accountant" },
  })
    .select("_id role")
    .sort({ role: 1, name: 1, email: 1 })
    .lean<Array<{ _id: mongoose.Types.ObjectId; role?: string | null }>>();

  const ownerId =
    params.invoiceOwnerId && companyUsers.some((user) => String(user._id) === params.invoiceOwnerId)
      ? params.invoiceOwnerId
      : null;

  const adminIds = companyUsers
    .filter((user) => user.role === "administrator")
    .map((user) => String(user._id));

  const fallbackIds = companyUsers.slice(0, 3).map((user) => String(user._id));

  return uniqueIds([ownerId, ...adminIds, ...fallbackIds]);
}

export async function createAccountantPurchaseTicket(params: {
  companyId: string;
  accountantUserId: string;
  expenseId: string;
  reason: AccountantPurchaseTicketReason;
  note?: string | null;
  locale: "en" | "fr";
  ipAddress?: string | null;
}): Promise<RepositoryResult<AccountantPurchaseTicketData>> {
  if (
    !isValidObjectId(params.companyId) ||
    !isValidObjectId(params.accountantUserId) ||
    !isValidObjectId(params.expenseId)
  ) {
    return { success: false, status: 400, message: "Invalid ticket context" };
  }

  await ConnectDb();

  const expense = await Expense.findOne({
    _id: toObjectId(params.expenseId),
    companyId: toObjectId(params.companyId),
    deletedAt: null,
  })
    .populate("supplierId", "fullName companyName")
    .lean<{
      _id: mongoose.Types.ObjectId;
      status?: string | null;
      paymentStatus?: string | null;
      expenseDate?: Date | null;
      dueDate?: Date | null;
      amountInclVatCents?: number;
      vatAmountCents?: number;
      supplierRef?: string | null;
      notes?: string | null;
      createdBy?: mongoose.Types.ObjectId | null;
      supplierId?: {
        _id?: mongoose.Types.ObjectId;
        fullName?: string | null;
        companyName?: string | null;
      } | null;
    } | null>();

  if (!expense) {
    return { success: false, status: 404, message: "Purchase not found" };
  }

  if (expense.status && expense.status !== "active") {
    return { success: false, status: 400, message: "Only active purchases can open a ticket" };
  }

  const attachments = await ExpenseAttachment.find({
    companyId: toObjectId(params.companyId),
    expenseId: expense._id,
  })
    .select("originalName displayName mimeType extension sizeBytes storageKey url checksum")
    .sort({ createdAt: -1 })
    .lean<
      Array<{
        originalName?: string;
        displayName?: string;
        mimeType?: string;
        extension?: string;
        sizeBytes?: number;
        storageKey?: string;
        url?: string;
        checksum?: string | null;
      }>
    >();

  const supplierLabel =
    expense.supplierId?.companyName ||
    expense.supplierId?.fullName ||
    expense.supplierRef ||
    `#${String(expense._id).slice(-6)}`;
  const reasonMeta = normalizePurchaseTicketReason(params.reason, params.locale);
  const recipientIds = await resolvePortalPurchaseTicketRecipients({
    companyId: params.companyId,
    expenseOwnerId: expense.createdBy ? String(expense.createdBy) : null,
  });

  const attachmentNames = attachments
    .map((attachment) => attachment.displayName || attachment.originalName || null)
    .filter((value): value is string => Boolean(value))
    .slice(0, 6);
  const attachmentSummary =
    attachmentNames.length > 0
      ? `${attachmentNames.join(", ")}${attachments.length > attachmentNames.length ? `${params.locale === "fr" ? ` (+${attachments.length - attachmentNames.length} autres)` : ` (+${attachments.length - attachmentNames.length} more)`}` : ""}`
      : params.locale === "fr"
        ? "Aucune piece jointe existante"
        : "No existing attachments";

  const bodyLines = params.locale === "fr"
    ? [
        "Ticket cree depuis le portail comptable ROBY.",
        "",
        `Motif: ${reasonMeta.title}`,
        `Fournisseur: ${supplierLabel}`,
        `Reference: ${expense.supplierRef || "-"}`,
        `Date de depense: ${formatPortalDate(expense.expenseDate, params.locale)}`,
        `Echeance: ${formatPortalDate(expense.dueDate, params.locale)}`,
        `Total TTC: ${formatPortalMoney(toCents(expense.amountInclVatCents), params.locale)}`,
        `TVA: ${formatPortalMoney(toCents(expense.vatAmountCents), params.locale)}`,
        `Statut de paiement: ${expense.paymentStatus || "unpaid"}`,
        `Pieces jointes liees: ${attachmentSummary}`,
        expense.notes ? `Note de depense: ${expense.notes}` : null,
        "",
        reasonMeta.prompt,
        params.note?.trim() ? "" : null,
        params.note?.trim() ? `Message comptable: ${params.note.trim()}` : null,
      ]
    : [
        "Ticket created from the ROBY accountant portal.",
        "",
        `Reason: ${reasonMeta.title}`,
        `Supplier: ${supplierLabel}`,
        `Reference: ${expense.supplierRef || "-"}`,
        `Expense date: ${formatPortalDate(expense.expenseDate, params.locale)}`,
        `Due date: ${formatPortalDate(expense.dueDate, params.locale)}`,
        `Total incl. VAT: ${formatPortalMoney(toCents(expense.amountInclVatCents), params.locale)}`,
        `VAT: ${formatPortalMoney(toCents(expense.vatAmountCents), params.locale)}`,
        `Payment status: ${expense.paymentStatus || "unpaid"}`,
        `Linked attachments: ${attachmentSummary}`,
        expense.notes ? `Purchase note: ${expense.notes}` : null,
        "",
        reasonMeta.prompt,
        params.note?.trim() ? "" : null,
        params.note?.trim() ? `Accountant note: ${params.note.trim()}` : null,
      ];

  const created = await createTicket({
    companyId: params.companyId,
    createdBy: params.accountantUserId,
    ipAddress: params.ipAddress,
    payload: {
      title: `${reasonMeta.title} - ${supplierLabel}`,
      type: reasonMeta.type,
      assignedTo: recipientIds,
      linkedType: "expense",
      linkedId: String(expense._id),
      body: bodyLines.filter((line): line is string => typeof line === "string").join("\n"),
      attachments: attachments
        .filter(
          (attachment): attachment is typeof attachment & { mimeType: TicketAllowedMimeType; storageKey: string; url: string } =>
            Boolean(attachment.url && attachment.storageKey && isPortalTicketMimeType(attachment.mimeType))
        )
        .map((attachment) => ({
          originalName: String(attachment.originalName || attachment.displayName || "attachment"),
          displayName: String(attachment.displayName || attachment.originalName || "Attachment"),
          mimeType: attachment.mimeType,
          extension: String(attachment.extension || "file"),
          sizeBytes: Math.max(0, Number(attachment.sizeBytes || 0)),
          storageKey: String(attachment.storageKey),
          url: String(attachment.url),
          checksum: typeof attachment.checksum === "string" ? attachment.checksum : null,
        })),
    },
  });

  if (!created.success || !created.ticket || !created.initialMessage) {
    return { success: false, status: 400, message: created.message || "Unable to create ticket" };
  }

  return {
    success: true,
    data: {
      ticketId: String((created.ticket as { _id?: unknown })._id || ""),
      ticket: created.ticket,
      initialMessage: created.initialMessage,
      recipientIds,
    },
  };
}

export async function createAccountantSalesTicket(params: {
  companyId: string;
  accountantUserId: string;
  invoiceId: string;
  reason: AccountantSalesTicketReason;
  note?: string | null;
  locale: "en" | "fr";
  ipAddress?: string | null;
}): Promise<RepositoryResult<AccountantSalesTicketData>> {
  if (
    !isValidObjectId(params.companyId) ||
    !isValidObjectId(params.accountantUserId) ||
    !isValidObjectId(params.invoiceId)
  ) {
    return { success: false, status: 400, message: "Invalid ticket context" };
  }

  await ConnectDb();

  const companyUserIds = await getCompanyUserObjectIds(params.companyId);
  const invoice = await Invoice.findOne({
    _id: toObjectId(params.invoiceId),
    userId: { $in: companyUserIds },
  })
    .select(
      "_id invoiceNumber date dueDate status totalExcludingTax totalVat totalIncludingTax notes userId clientSnapshot"
    )
    .lean<{
      _id: mongoose.Types.ObjectId;
      invoiceNumber: string;
      date?: Date | null;
      dueDate?: Date | null;
      status?: string | null;
      totalExcludingTax?: number;
      totalVat?: number;
      totalIncludingTax?: number;
      notes?: string | null;
      userId?: mongoose.Types.ObjectId | null;
      clientSnapshot?: {
        fullName?: string | null;
        companyName?: string | null;
        email?: string | null;
      } | null;
    } | null>();

  if (!invoice) {
    return { success: false, status: 404, message: "Invoice not found" };
  }

  const succeededPayments = await Payment.find({
    invoiceId: invoice._id,
    status: "succeeded",
  })
    .sort({ paidAt: -1, createdAt: -1 })
    .select("amount method type paidAt createdAt")
    .lean<Array<{
      amount?: number;
      method?: string | null;
      type?: string | null;
      paidAt?: Date | null;
      createdAt?: Date | null;
    }>>();

  const amountPaidCents = succeededPayments.reduce(
    (sum, payment) => sum + toCents(payment.amount),
    0
  );
  const totalIncludingTaxCents = toCents(invoice.totalIncludingTax);
  const amountRemainingCents = Math.max(0, totalIncludingTaxCents - amountPaidCents);
  const latestPayment = succeededPayments[0] || null;
  const clientLabel =
    invoice.clientSnapshot?.companyName ||
    invoice.clientSnapshot?.fullName ||
    invoice.invoiceNumber;
  const reasonMeta = normalizeSalesTicketReason(params.reason, params.locale);
  const recipientIds = await resolvePortalInvoiceTicketRecipients({
    companyId: params.companyId,
    invoiceOwnerId: invoice.userId ? String(invoice.userId) : null,
  });
  const normalizedStatus = normalizeInvoiceStatus(invoice.status, invoice.dueDate);

  const paymentSummary =
    succeededPayments.length > 0
      ? params.locale === "fr"
        ? `${succeededPayments.length} paiement(s) enregistre(s), dernier ${formatPortalMoney(toCents(latestPayment?.amount), params.locale)} le ${formatPortalDate(latestPayment?.paidAt || latestPayment?.createdAt, params.locale)}`
        : `${succeededPayments.length} recorded payment(s), latest ${formatPortalMoney(toCents(latestPayment?.amount), params.locale)} on ${formatPortalDate(latestPayment?.paidAt || latestPayment?.createdAt, params.locale)}`
      : params.locale === "fr"
        ? "Aucun paiement enregistre"
        : "No recorded payments";

  const bodyLines = params.locale === "fr"
    ? [
        "Ticket cree depuis le portail comptable ROBY.",
        "",
        `Motif: ${reasonMeta.title}`,
        `Facture: ${invoice.invoiceNumber}`,
        `Client: ${clientLabel}`,
        `Date de facture: ${formatPortalDate(invoice.date, params.locale)}`,
        `Echeance: ${formatPortalDate(invoice.dueDate, params.locale)}`,
        `Statut: ${normalizedStatus}`,
        `Total TTC: ${formatPortalMoney(totalIncludingTaxCents, params.locale)}`,
        `Montant paye: ${formatPortalMoney(amountPaidCents, params.locale)}`,
        `Montant restant: ${formatPortalMoney(amountRemainingCents, params.locale)}`,
        `Paiements: ${paymentSummary}`,
        invoice.notes ? `Note de facture: ${invoice.notes}` : null,
        invoice.clientSnapshot?.email ? `Email client: ${invoice.clientSnapshot.email}` : null,
        "",
        reasonMeta.prompt,
        params.note?.trim() ? "" : null,
        params.note?.trim() ? `Message comptable: ${params.note.trim()}` : null,
      ]
    : [
        "Ticket created from the ROBY accountant portal.",
        "",
        `Reason: ${reasonMeta.title}`,
        `Invoice: ${invoice.invoiceNumber}`,
        `Client: ${clientLabel}`,
        `Invoice date: ${formatPortalDate(invoice.date, params.locale)}`,
        `Due date: ${formatPortalDate(invoice.dueDate, params.locale)}`,
        `Status: ${normalizedStatus}`,
        `Total incl. VAT: ${formatPortalMoney(totalIncludingTaxCents, params.locale)}`,
        `Amount paid: ${formatPortalMoney(amountPaidCents, params.locale)}`,
        `Amount remaining: ${formatPortalMoney(amountRemainingCents, params.locale)}`,
        `Payments: ${paymentSummary}`,
        invoice.notes ? `Invoice note: ${invoice.notes}` : null,
        invoice.clientSnapshot?.email ? `Client email: ${invoice.clientSnapshot.email}` : null,
        "",
        reasonMeta.prompt,
        params.note?.trim() ? "" : null,
        params.note?.trim() ? `Accountant note: ${params.note.trim()}` : null,
      ];

  const created = await createTicket({
    companyId: params.companyId,
    createdBy: params.accountantUserId,
    ipAddress: params.ipAddress,
    payload: {
      title: `${reasonMeta.title} - ${invoice.invoiceNumber}`,
      type: reasonMeta.type,
      assignedTo: recipientIds,
      linkedType: "invoice",
      linkedId: String(invoice._id),
      body: bodyLines.filter((line): line is string => typeof line === "string").join("\n"),
      attachments: [],
    },
  });

  if (!created.success || !created.ticket || !created.initialMessage) {
    return { success: false, status: 400, message: created.message || "Unable to create ticket" };
  }

  return {
    success: true,
    data: {
      ticketId: String((created.ticket as { _id?: unknown })._id || ""),
      ticket: created.ticket,
      initialMessage: created.initialMessage,
      recipientIds,
    },
  };
}