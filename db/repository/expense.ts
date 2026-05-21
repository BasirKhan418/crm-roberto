import mongoose from "mongoose";

import ConnectDb from "@/db/connectDb";
import "@/db/models/Client";
import Expense from "@/db/models/Expense";
import ExpenseAttachment from "@/db/models/ExpenseAttachment";
import ExpensePaymentLine from "@/db/models/ExpensePaymentLine";
import "@/db/models/ExpenseCategory";
import "@/db/models/Invoice";
import Supplier from "@/db/models/Supplier";
import "@/db/models/User";
import { computeAmountInclVatCents, computeRemainingBalanceCents, computeVatAmountCents } from "@/lib/expense-calculations";
import {
  EXPENSE_ATTACHMENT_DELETE_REASONS,
  EXPENSE_PAID_BY,
  EXPENSE_PAYMENT_METHODS,
  type ExpenseAttachmentDeleteReason,
} from "@/lib/expenses/constants";
import { normalizeRole } from "@/lib/permissions";
import { isExpenseReadyForPayment } from "@/lib/expenses/payment-readiness";
import type { ListQueryOptions, PaginationMeta } from "@/utils/api/query";
import { buildPagination } from "@/utils/api/query";
import type {
  AddExpensePaymentDTO,
  CreateDraftExpenseDTO,
  ExpenseAttachmentMetadataDTO,
  CreateManualExpenseDTO,
  ExpenseListFilterDTO,
  MarkExpensePaidDTO,
  UpdateExpenseDTO,
} from "@/validators/expense.schema";
import { listAuditLogsForEntity, recordAuditLog, recordEntityFieldDiff } from "@/db/repository/audit";

type ExpenseListResult = {
  items: Array<Record<string, unknown>>;
  pagination: PaginationMeta;
};

type AccessScope = {
  ownOnly?: boolean;
  userId?: string;
};

type AttachmentNamingExpense = {
  supplierId?: unknown;
  supplierRef?: string | null;
  expenseDate?: Date | null;
  amountInclVatCents?: number;
  status?: string | null;
};

type ExpensePaymentLineRecord = {
  _id: mongoose.Types.ObjectId | string;
  companyId: mongoose.Types.ObjectId | string;
  expenseId: mongoose.Types.ObjectId | string;
  amountPaidCents: number;
  paidAt: Date;
  paymentMethod?: string | null;
  paidBy?: string | null;
  createdBy?: unknown;
  createdAt?: Date;
  updatedAt?: Date;
};

const DEFAULT_EXPENSE_VAT_RATE = 17;
const DEFAULT_DUE_DATE_DELAY_DAYS = 7;

function canRestoreArchivedWithRole(role: string | null | undefined) {
  const normalized = normalizeRole(role);
  return normalized === "super_admin" || normalized === "administrator";
}

function isValidObjectId(value: string) {
  return mongoose.Types.ObjectId.isValid(value);
}

function toObjectId(value: string) {
  return new mongoose.Types.ObjectId(value);
}

function extractObjectIdString(value: unknown): string | null {
  if (!value) return null;

  if (typeof value === "string") {
    return isValidObjectId(value) ? value : null;
  }

  if (value instanceof mongoose.Types.ObjectId) {
    return String(value);
  }

  if (typeof value === "object") {
    const maybeId = (value as { _id?: unknown })._id;
    if (typeof maybeId === "string" && isValidObjectId(maybeId)) {
      return maybeId;
    }
    if (maybeId instanceof mongoose.Types.ObjectId) {
      return String(maybeId);
    }
  }

  return null;
}

function toPositiveCents(value: unknown) {
  if (typeof value !== "number") {
    return 0;
  }

  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.round(value));
}

function toValidExpensePaymentMethod(value: unknown) {
  if (typeof value !== "string") return null;
  return EXPENSE_PAYMENT_METHODS.includes(value as (typeof EXPENSE_PAYMENT_METHODS)[number])
    ? value
    : null;
}

function toValidExpensePaidBy(value: unknown) {
  if (typeof value !== "string") return null;
  return EXPENSE_PAID_BY.includes(value as (typeof EXPENSE_PAID_BY)[number]) ? value : null;
}

function toValidAttachmentDeleteReason(value: unknown): ExpenseAttachmentDeleteReason | null {
  if (typeof value !== "string") return null;
  return EXPENSE_ATTACHMENT_DELETE_REASONS.includes(
    value as (typeof EXPENSE_ATTACHMENT_DELETE_REASONS)[number]
  )
    ? (value as ExpenseAttachmentDeleteReason)
    : null;
}

function toDateOrNull(value: unknown) {
  if (!value) return null;

  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

async function listExpensePaymentLines(params: {
  companyId: string;
  expenseId: string;
  includeCreator?: boolean;
}) {
  let query = ExpensePaymentLine.find({
    companyId: params.companyId,
    expenseId: params.expenseId,
  }).sort({ paidAt: -1, createdAt: -1 });

  if (params.includeCreator) {
    query = query.populate("createdBy", "name email");
  }

  return query.lean<ExpensePaymentLineRecord[]>();
}

function summarizeExpensePayments(params: {
  amountInclVatCents: number;
  paymentLines: ExpensePaymentLineRecord[];
}) {
  const totalAmountCents = Math.max(0, toPositiveCents(params.amountInclVatCents));
  const rawPaidCents = params.paymentLines.reduce((sum, line) => {
    return sum + toPositiveCents(line.amountPaidCents);
  }, 0);

  const amountPaidCents = Math.min(rawPaidCents, totalAmountCents);
  const paymentStatus = derivePaymentStatus(totalAmountCents, amountPaidCents);
  const latestPayment = params.paymentLines[0] || null;

  return {
    amountPaidCents,
    paymentStatus,
    paymentMethod: latestPayment?.paymentMethod ?? null,
    paidBy: latestPayment?.paidBy ?? null,
    paidAt: latestPayment?.paidAt ?? null,
  };
}

function applyExpensePaymentSummary(expense: {
  amountPaidCents?: number;
  paymentStatus?: string;
  paymentMethod?: string | null;
  paidBy?: string | null;
  paidAt?: Date | null;
}, summary: {
  amountPaidCents: number;
  paymentStatus: string;
  paymentMethod: string | null;
  paidBy: string | null;
  paidAt: Date | null;
}) {
  expense.amountPaidCents = summary.amountPaidCents;
  expense.paymentStatus = summary.paymentStatus;
  expense.paymentMethod = summary.paymentMethod;
  expense.paidBy = summary.paidBy;
  expense.paidAt = summary.paidAt;
}

async function ensureLegacyPaymentLines(params: {
  companyId: string;
  expense: Record<string, unknown>;
  fallbackCreatedBy?: string;
}) {
  const expenseId = extractObjectIdString(params.expense._id);
  if (!expenseId) {
    return [] as ExpensePaymentLineRecord[];
  }

  const existingLines = await listExpensePaymentLines({
    companyId: params.companyId,
    expenseId,
  });

  if (existingLines.length > 0) {
    return existingLines;
  }

  const existingAmountPaidCents = toPositiveCents(params.expense.amountPaidCents);
  const existingAmountInclVatCents = toPositiveCents(params.expense.amountInclVatCents);
  const legacyPaidCents = Math.min(existingAmountPaidCents, existingAmountInclVatCents);

  if (legacyPaidCents <= 0) {
    return existingLines;
  }

  const createdBy =
    params.fallbackCreatedBy ||
    extractObjectIdString(params.expense.updatedBy) ||
    extractObjectIdString(params.expense.createdBy);

  if (!createdBy || !isValidObjectId(createdBy)) {
    return existingLines;
  }

  const paidAt =
    toDateOrNull(params.expense.paidAt) ||
    toDateOrNull(params.expense.updatedAt) ||
    toDateOrNull(params.expense.createdAt) ||
    new Date();

  const createdLegacyLine = await ExpensePaymentLine.create({
    companyId: params.companyId,
    expenseId,
    amountPaidCents: legacyPaidCents,
    paidAt,
    paymentMethod: toValidExpensePaymentMethod(params.expense.paymentMethod),
    paidBy: toValidExpensePaidBy(params.expense.paidBy),
    createdBy,
    source: "legacy_migration",
  });

  return [createdLegacyLine.toObject() as ExpensePaymentLineRecord];
}

function buildRemainingBalance(expense: {
  amountInclVatCents?: number;
  amountPaidCents?: number;
}) {
  return computeRemainingBalanceCents(expense.amountInclVatCents || 0, expense.amountPaidCents || 0);
}

function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

function sanitizeFileNamePart(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/(^_+|_+$)/g, "")
    .slice(0, 70);
}

function normalizeExtension(extension: string | undefined, fallbackName?: string | null) {
  const fromExtension = extension?.replace(/^\./, "").toLowerCase().trim();
  if (fromExtension && /^[a-z0-9]+$/.test(fromExtension)) {
    return fromExtension;
  }

  const fromName = fallbackName?.split(".").pop()?.toLowerCase().trim();
  if (fromName && /^[a-z0-9]+$/.test(fromName)) {
    return fromName;
  }

  return "bin";
}

function formatDateForFileName(value?: Date | null) {
  if (!value) return null;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const year = String(date.getUTCFullYear());
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function formatAmountForFileName(cents?: number) {
  if (typeof cents !== "number" || cents <= 0) return null;

  const value = (cents / 100).toFixed(2).replace(".", "_");
  return `${value}eur`;
}

function extractSupplierId(value: unknown): string | null {
  if (!value) return null;

  if (typeof value === "string") {
    return isValidObjectId(value) ? value : null;
  }

  if (typeof value === "object") {
    const maybeId = (value as { _id?: unknown })._id;
    if (typeof maybeId === "string") {
      return isValidObjectId(maybeId) ? maybeId : null;
    }
    if (maybeId instanceof mongoose.Types.ObjectId) {
      return String(maybeId);
    }
  }

  if (value instanceof mongoose.Types.ObjectId) {
    return String(value);
  }

  return null;
}

async function resolveSupplierName(value: unknown): Promise<string | null> {
  if (!value) return null;

  if (typeof value === "object") {
    const fullName = (value as { fullName?: unknown }).fullName;
    if (typeof fullName === "string" && fullName.trim()) {
      return fullName.trim();
    }
  }

  const supplierId = extractSupplierId(value);
  if (!supplierId) return null;

  const supplier = await Supplier.findById(supplierId).select("fullName").lean<{ fullName?: string } | null>();
  return supplier?.fullName?.trim() || null;
}

function hasCanonicalAttachmentNamingData(expense: AttachmentNamingExpense, supplierName: string | null) {
  return Boolean(
    supplierName &&
      expense.expenseDate &&
      typeof expense.amountInclVatCents === "number" &&
      expense.amountInclVatCents > 0
  );
}

async function buildAttachmentDisplayName(params: {
  expense: AttachmentNamingExpense;
  extension?: string;
  fallbackName: string;
}) {
  const supplierName = await resolveSupplierName(params.expense.supplierId);
  if (!hasCanonicalAttachmentNamingData(params.expense, supplierName)) {
    return params.fallbackName;
  }

  const supplierPart = sanitizeFileNamePart(supplierName || "expense");
  const datePart = formatDateForFileName(params.expense.expenseDate) || "draft";
  const amountPart = formatAmountForFileName(params.expense.amountInclVatCents) || "amount";
  const extension = normalizeExtension(params.extension, params.fallbackName);

  return `${supplierPart}_${datePart}_${amountPart}.${extension}`;
}

async function syncAttachmentDisplayNames(params: {
  companyId: string;
  expenseId: string;
  expense: AttachmentNamingExpense;
}) {
  const supplierName = await resolveSupplierName(params.expense.supplierId);
  if (!hasCanonicalAttachmentNamingData(params.expense, supplierName)) {
    return;
  }

  const attachments = await ExpenseAttachment.find({
    companyId: params.companyId,
    expenseId: params.expenseId,
  })
    .sort({ createdAt: 1 })
    .lean();

  if (attachments.length === 0) {
    return;
  }

  const supplierPart = sanitizeFileNamePart(supplierName || "expense");
  const datePart = formatDateForFileName(params.expense.expenseDate) || "draft";
  const amountPart = formatAmountForFileName(params.expense.amountInclVatCents) || "amount";
  const base = `${supplierPart}_${datePart}_${amountPart}`;

  const updates = attachments
    .map((attachment, index) => {
      const extension = normalizeExtension(attachment.extension, attachment.originalName);
      const suffix = attachments.length > 1 ? `_${index + 1}` : "";
      const displayName = `${base}${suffix}.${extension}`;

      if (displayName === attachment.displayName) {
        return null;
      }

      return {
        updateOne: {
          filter: { _id: attachment._id },
          update: { $set: { displayName } },
        },
      };
    })
    .filter(Boolean) as Array<{
    updateOne: {
      filter: { _id: mongoose.Types.ObjectId };
      update: { $set: { displayName: string } };
    };
  }>;

  if (updates.length > 0) {
    await ExpenseAttachment.bulkWrite(updates);
  }
}

function addAccessScopeToQuery(query: Record<string, unknown>, access?: AccessScope) {
  if (access?.ownOnly && access.userId) {
    return {
      ...query,
      createdBy: access.userId,
    };
  }

  return query;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function canActivateExpense(expense: {
  amountInclVatCents?: number;
  expenseDate?: Date | null;
  categoryId?: unknown;
}) {
  return Boolean(
    (expense.amountInclVatCents || 0) > 0 &&
      expense.expenseDate &&
      expense.categoryId
  );
}

function derivePaymentStatus(amountInclVatCents: number, amountPaidCents: number) {
  const remaining = computeRemainingBalanceCents(amountInclVatCents, amountPaidCents);
  if (remaining === 0 && amountInclVatCents > 0) return "paid";
  if (amountPaidCents > 0) return "partial";
  return "unpaid";
}

function buildDuplicatedSupplierReference(sourceReference: unknown): string | null {
  if (typeof sourceReference !== "string") {
    return null;
  }

  const normalizedReference = sourceReference.trim();
  if (!normalizedReference) {
    return null;
  }

  const timestamp = new Date()
    .toISOString()
    .replace(/[-:TZ.]/g, "")
    .slice(0, 14);
  const randomSuffix = Math.floor(100 + Math.random() * 900);
  const suffix = `DUP${timestamp}${randomSuffix}`;

  const maxBaseLength = Math.max(0, 140 - suffix.length - 1);
  const base = normalizedReference.slice(0, maxBaseLength);
  if (!base) {
    return suffix;
  }

  return `${base}-${suffix}`;
}

function parseSort(options: ListQueryOptions) {
  const direction: 1 | -1 = options.sortOrder === "asc" ? 1 : -1;
  const sortByAllowed = ["expenseDate", "amountInclVatCents", "supplierRef", "status", "createdAt"];
  const sortBy = sortByAllowed.includes(options.sortBy) ? options.sortBy : "expenseDate";
  return { [sortBy]: direction } as Record<string, 1 | -1>;
}

export async function createDraftFromAttachment(params: {
  companyId: string;
  createdBy: string;
  payload: CreateDraftExpenseDTO;
  ipAddress?: string | null;
}) {
  await ConnectDb();

  if (!isValidObjectId(params.companyId) || !isValidObjectId(params.createdBy)) {
    return { success: false as const, message: "Invalid draft context" };
  }

  const amountExclVatCents = params.payload.amountExclVatCents || 0;
  const vatRate = params.payload.vatRate ?? DEFAULT_EXPENSE_VAT_RATE;
  const vatAmountCents = computeVatAmountCents(amountExclVatCents, vatRate);
  const amountInclVatCents = computeAmountInclVatCents(amountExclVatCents, vatAmountCents);
  const expenseDate = params.payload.expenseDate ?? new Date();
  const dueDate = addDays(expenseDate, DEFAULT_DUE_DATE_DELAY_DAYS);

  const displayName = await buildAttachmentDisplayName({
    expense: {
      supplierId: params.payload.supplierId ?? null,
      supplierRef: params.payload.supplierRef ?? null,
      expenseDate,
      amountInclVatCents,
    },
    extension: params.payload.attachment.extension,
    fallbackName: params.payload.attachment.displayName,
  });

  const draft = await Expense.create({
    companyId: params.companyId,
    status: "draft",
    paymentStatus: "unpaid",
    amountExclVatCents,
    vatRate,
    vatAmountCents,
    amountInclVatCents,
    amountPaidCents: 0,
    expenseDate,
    dueDate,
    supplierId: params.payload.supplierId || null,
    categoryId: params.payload.categoryId || null,
    supplierRef: params.payload.supplierRef ?? null,
    notes: params.payload.notes ?? null,
    createdBy: params.createdBy,
    updatedBy: params.createdBy,
  });

  const attachment = await ExpenseAttachment.create({
    companyId: params.companyId,
    expenseId: draft._id,
    uploadedBy: params.createdBy,
    originalName: params.payload.attachment.originalName,
    displayName,
    mimeType: params.payload.attachment.mimeType,
    extension: params.payload.attachment.extension,
    sizeBytes: params.payload.attachment.sizeBytes,
    storageKey: params.payload.attachment.storageKey,
    url: params.payload.attachment.url,
    checksum: params.payload.attachment.checksum ?? null,
  });

  await recordAuditLog({
    entityType: "expense",
    entityId: String(draft._id),
    companyId: params.companyId,
    action: "created",
    performedBy: params.createdBy,
    source: "api",
    ipAddress: params.ipAddress,
  });

  return {
    success: true as const,
    expense: {
      ...draft.toObject(),
      remainingBalanceCents: buildRemainingBalance(draft),
    },
    attachment: attachment.toObject(),
  };
}

export async function createManualExpense(params: {
  companyId: string;
  createdBy: string;
  payload: CreateManualExpenseDTO;
  ipAddress?: string | null;
}) {
  await ConnectDb();

  if (!isValidObjectId(params.companyId) || !isValidObjectId(params.createdBy)) {
    return { success: false as const, message: "Invalid expense context" };
  }

  const vatAmountCents = computeVatAmountCents(params.payload.amountExclVatCents, params.payload.vatRate);
  const amountInclVatCents = computeAmountInclVatCents(params.payload.amountExclVatCents, vatAmountCents);
  const dueDate = params.payload.dueDate ?? addDays(params.payload.expenseDate, DEFAULT_DUE_DATE_DELAY_DAYS);
  const requestedStatus = params.payload.status === "draft" ? "draft" : "active";
  const requestedPaymentStatus = params.payload.paymentStatus || "unpaid";
  const normalizedPaymentStatus = requestedStatus === "draft" ? "unpaid" : requestedPaymentStatus;
  const normalizedPaymentMethod =
    normalizedPaymentStatus === "unpaid"
      ? null
      : toValidExpensePaymentMethod(params.payload.paymentMethod);
  const normalizedPaidBy =
    normalizedPaymentStatus === "unpaid" ? null : toValidExpensePaidBy(params.payload.paidBy);
  const normalizedPaidAt =
    normalizedPaymentStatus === "unpaid"
      ? null
      : params.payload.paidAt ?? params.payload.expenseDate ?? new Date();

  const created = await Expense.create({
    companyId: params.companyId,
    status: requestedStatus,
    paymentStatus: "unpaid",
    amountExclVatCents: params.payload.amountExclVatCents,
    vatRate: params.payload.vatRate,
    vatAmountCents,
    amountInclVatCents,
    expenseDate: params.payload.expenseDate,
    supplierId: params.payload.supplierId,
    categoryId: params.payload.categoryId,
    paymentMethod: null,
    paidBy: null,
    amountPaidCents: 0,
    paidAt: null,
    dueDate,
    supplierRef: params.payload.supplierRef ?? null,
    expenseType: params.payload.expenseType,
    notes: params.payload.notes ?? null,
    clientId: params.payload.clientId ?? null,
    projectId: params.payload.projectId ?? null,
    invoiceId: params.payload.invoiceId ?? null,
    createdBy: params.createdBy,
    updatedBy: params.createdBy,
  });

  const requestedInitialPaymentCents =
    requestedStatus === "draft"
      ? 0
      : normalizedPaymentStatus === "paid"
      ? amountInclVatCents
      : toPositiveCents(params.payload.amountPaidCents);

  const initialPaymentCents =
    requestedStatus === "draft" || normalizedPaymentStatus === "unpaid"
      ? 0
      : Math.min(requestedInitialPaymentCents, amountInclVatCents);

  if (initialPaymentCents > 0) {
    await ExpensePaymentLine.create({
      companyId: params.companyId,
      expenseId: created._id,
      amountPaidCents: initialPaymentCents,
      paidAt: normalizedPaidAt,
      paymentMethod: normalizedPaymentMethod,
      paidBy: normalizedPaidBy,
      createdBy: params.createdBy,
      source: "manual_create",
    });
  }

  const paymentLines = await listExpensePaymentLines({
    companyId: params.companyId,
    expenseId: String(created._id),
  });
  const paymentSummary = summarizeExpensePayments({
    amountInclVatCents,
    paymentLines,
  });

  applyExpensePaymentSummary(created, paymentSummary);
  created.updatedBy = toObjectId(params.createdBy);
  await created.save();

  await recordAuditLog({
    entityType: "expense",
    entityId: String(created._id),
    companyId: params.companyId,
    action: "created",
    performedBy: params.createdBy,
    source: "api",
    ipAddress: params.ipAddress,
  });

  return {
    success: true as const,
    expense: {
      ...created.toObject(),
      remainingBalanceCents: buildRemainingBalance(created),
    },
  };
}

export async function listExpenses(params: {
  companyId: string;
  options: ListQueryOptions;
  filters?: ExpenseListFilterDTO;
  access?: AccessScope;
}): Promise<ExpenseListResult> {
  await ConnectDb();

  const query: Record<string, unknown> = {
    companyId: params.companyId,
    deletedAt: null,
  };

  if (params.access?.ownOnly && params.access.userId) {
    query.createdBy = params.access.userId;
  }

  if (params.filters?.status) {
    query.status = params.filters.status;
  } else {
    query.status = { $ne: "archived" };
  }

  if (params.filters?.paymentStatus) {
    query.paymentStatus = params.filters.paymentStatus;
  }

  if (params.filters?.categoryId) {
    query.categoryId = params.filters.categoryId;
  }

  if (params.filters?.supplierId) {
    query.supplierId = params.filters.supplierId;
  }

  if (params.filters?.periodStart || params.filters?.periodEnd) {
    const dateQuery: Record<string, Date> = {};
    if (params.filters.periodStart) {
      dateQuery.$gte = params.filters.periodStart;
    }
    if (params.filters.periodEnd) {
      dateQuery.$lte = params.filters.periodEnd;
    }
    query.expenseDate = dateQuery;
  }

  if (params.options.search) {
    const searchRegex = new RegExp(escapeRegex(params.options.search), "i");
    const supplierMatches = await Supplier.find({ fullName: { $regex: searchRegex } })
      .select("_id")
      .limit(200)
      .lean<{ _id: mongoose.Types.ObjectId }[]>();

    const supplierIds = supplierMatches.map((supplier) => supplier._id);

    query.$or = [
      { supplierRef: { $regex: searchRegex } },
      { notes: { $regex: searchRegex } },
      ...(supplierIds.length > 0 ? [{ supplierId: { $in: supplierIds } }] : []),
    ];
  }

  const skip = (params.options.page - 1) * params.options.limit;

  const [items, total] = await Promise.all([
    Expense.find(query)
      .sort(parseSort(params.options))
      .skip(skip)
      .limit(params.options.limit)
      .populate("supplierId", "fullName companyName")
      .populate("categoryId", "name nameEn nameFr canonicalKey")
      .lean(),
    Expense.countDocuments(query),
  ]);

  const expenseObjectIds = items
    .map((item) => {
      const rawId = item._id;
      const asString = typeof rawId === "string" ? rawId : String(rawId);
      return isValidObjectId(asString) ? new mongoose.Types.ObjectId(asString) : null;
    })
    .filter(Boolean) as mongoose.Types.ObjectId[];

  const attachmentCountRows =
    expenseObjectIds.length > 0
      ? await ExpenseAttachment.aggregate<{
          _id: mongoose.Types.ObjectId;
          count: number;
        }>([
          {
            $match: {
              expenseId: { $in: expenseObjectIds },
            },
          },
          {
            $group: {
              _id: "$expenseId",
              count: { $sum: 1 },
            },
          },
        ])
      : [];

  const attachmentCountByExpenseId = new Map(
    attachmentCountRows.map((row) => [String(row._id), row.count])
  );

  return {
    items: items.map((item) => ({
      ...item,
      attachmentsCount: attachmentCountByExpenseId.get(String(item._id)) || 0,
      remainingBalanceCents: buildRemainingBalance(item),
    })),
    pagination: buildPagination(params.options.page, params.options.limit, total),
  };
}

export async function getExpenseById(params: {
  companyId: string;
  expenseId: string;
  access?: AccessScope;
}) {
  await ConnectDb();

  if (!isValidObjectId(params.companyId) || !isValidObjectId(params.expenseId)) {
    return { success: false as const, message: "Invalid expense context" };
  }

  const query: Record<string, unknown> = {
    _id: params.expenseId,
    companyId: params.companyId,
    deletedAt: null,
  };

  if (params.access?.ownOnly && params.access.userId) {
    query.createdBy = params.access.userId;
  }

  const expense = await Expense.findOne(query)
    .populate("supplierId")
    .populate("categoryId")
    .populate("clientId")
    .populate("invoiceId")
    .populate("createdBy", "name email")
    .populate("updatedBy", "name email")
    .lean();

  if (!expense) {
    return { success: false as const, message: "Expense not found" };
  }

  await ensureLegacyPaymentLines({
    companyId: params.companyId,
    expense: expense as Record<string, unknown>,
  });

  const [attachments, auditLogs, payments] = await Promise.all([
    ExpenseAttachment.find({ companyId: params.companyId, expenseId: params.expenseId })
      .sort({ createdAt: -1 })
      .lean(),
    listAuditLogsForEntity({
      companyId: params.companyId,
      entityType: "expense",
      entityId: params.expenseId,
    }),
    listExpensePaymentLines({
      companyId: params.companyId,
      expenseId: params.expenseId,
      includeCreator: true,
    }),
  ]);

  const paymentSummary = summarizeExpensePayments({
    amountInclVatCents: toPositiveCents(expense.amountInclVatCents),
    paymentLines: payments,
  });

  return {
    success: true as const,
    expense: {
      ...expense,
      amountPaidCents: paymentSummary.amountPaidCents,
      paymentStatus: paymentSummary.paymentStatus,
      paymentMethod: paymentSummary.paymentMethod,
      paidBy: paymentSummary.paidBy,
      paidAt: paymentSummary.paidAt,
      remainingBalanceCents: computeRemainingBalanceCents(
        toPositiveCents(expense.amountInclVatCents),
        paymentSummary.amountPaidCents
      ),
      attachments,
      payments,
      linkedTickets: [],
      auditLogs,
    },
  };
}

export async function updateExpense(params: {
  companyId: string;
  expenseId: string;
  updatedBy: string;
  payload: UpdateExpenseDTO;
  access?: AccessScope;
  ipAddress?: string | null;
}) {
  await ConnectDb();

  if (
    !isValidObjectId(params.companyId) ||
    !isValidObjectId(params.expenseId) ||
    !isValidObjectId(params.updatedBy)
  ) {
    return { success: false as const, message: "Invalid expense update context" };
  }

  const scopedQuery = addAccessScopeToQuery(
    {
      _id: params.expenseId,
      companyId: params.companyId,
      deletedAt: null,
    },
    params.access
  );

  const existing = await Expense.findOne(scopedQuery).lean<Record<string, unknown> | null>();

  if (!existing) {
    return { success: false as const, message: "Expense not found" };
  }

  if (existing.status === "archived") {
    return {
      success: false as const,
      message: "Archived expenses are read-only. Restore the expense before editing.",
    };
  }

  const {
    confirmPaidFinancialChange,
    ...payloadWithoutFinancialConfirmation
  } = params.payload;

  const nextData: Record<string, unknown> = {
    ...existing,
    ...payloadWithoutFinancialConfirmation,
    updatedBy: toObjectId(params.updatedBy),
  };

  const amountExclVatCents =
    typeof nextData.amountExclVatCents === "number" ? nextData.amountExclVatCents : Number(existing.amountExclVatCents || 0);
  const vatRate = typeof nextData.vatRate === "number" ? nextData.vatRate : Number(existing.vatRate || 0);

  const vatAmountCents = computeVatAmountCents(amountExclVatCents, vatRate);
  const amountInclVatCents = computeAmountInclVatCents(amountExclVatCents, vatAmountCents);

  const paymentLines = await ensureLegacyPaymentLines({
    companyId: params.companyId,
    expense: existing,
    fallbackCreatedBy: params.updatedBy,
  });
  const paymentSummary = summarizeExpensePayments({
    amountInclVatCents,
    paymentLines,
  });

  const existingStatus = typeof existing.status === "string" ? existing.status : "draft";
  const existingPaymentStatus =
    typeof existing.paymentStatus === "string" ? existing.paymentStatus : "unpaid";
  const explicitStatus =
    typeof payloadWithoutFinancialConfirmation.status === "string"
      ? payloadWithoutFinancialConfirmation.status
      : null;
  const requestedPaymentStatus =
    typeof payloadWithoutFinancialConfirmation.paymentStatus === "string"
      ? payloadWithoutFinancialConfirmation.paymentStatus
      : null;
  const requestedAmountPaidCents = toPositiveCents(payloadWithoutFinancialConfirmation.amountPaidCents);
  const hasPaymentIntentHints =
    requestedAmountPaidCents > 0 ||
    toValidExpensePaymentMethod(payloadWithoutFinancialConfirmation.paymentMethod) !== null ||
    toValidExpensePaidBy(payloadWithoutFinancialConfirmation.paidBy) !== null ||
    toDateOrNull(payloadWithoutFinancialConfirmation.paidAt) !== null;

  // If client status is accidentally missing but payment intent exists while editing a draft,
  // promote to active so finalize+pay cannot silently remain draft.
  const status =
    explicitStatus || (existingStatus === "draft" && hasPaymentIntentHints ? "active" : existingStatus);
  const isDraftActivation = existingStatus === "draft" && status === "active";
  const wantsPaidOnActivation =
    isDraftActivation &&
    (requestedPaymentStatus === "paid" ||
      (requestedPaymentStatus !== "unpaid" && hasPaymentIntentHints));

  const isAlreadyPaidExpense = existingStatus !== "draft" && existingPaymentStatus === "paid";
  const amountInclVatChanged = amountInclVatCents !== toPositiveCents(existing.amountInclVatCents);
  const vatRateChanged = vatRate !== Number(existing.vatRate || 0);
  const paymentFieldsTouched =
    typeof payloadWithoutFinancialConfirmation.amountPaidCents === "number" ||
    typeof payloadWithoutFinancialConfirmation.paymentStatus === "string" ||
    typeof payloadWithoutFinancialConfirmation.paymentMethod === "string" ||
    typeof payloadWithoutFinancialConfirmation.paidBy === "string" ||
    payloadWithoutFinancialConfirmation.paidAt !== undefined;
  const hasAccountingImpactingChange = amountInclVatChanged || vatRateChanged || paymentFieldsTouched;

  if (
    isAlreadyPaidExpense &&
    hasAccountingImpactingChange &&
    confirmPaidFinancialChange !== true
  ) {
    return {
      success: false as const,
      message:
        "Financial values changed on a paid expense. Confirm this accounting-impacting update before saving.",
    };
  }

  if (isDraftActivation && requestedPaymentStatus === "partial") {
    return {
      success: false as const,
      message: "Draft activation only supports unpaid or fully paid. Use Add payment after activation for partial payments.",
    };
  }

  const activateCandidate = {
    amountInclVatCents,
    expenseDate: (nextData.expenseDate as Date | null) ?? null,
    categoryId: nextData.categoryId,
  };

  if (status === "active" && !canActivateExpense(activateCandidate)) {
    return {
      success: false as const,
      message: "Draft cannot be activated until amount, date, and category are set",
    };
  }

  let effectivePaymentSummary = paymentSummary;
  let activationPaymentLineId: string | null = null;

  if (wantsPaidOnActivation) {
    const paymentMethod = toValidExpensePaymentMethod(params.payload.paymentMethod);
    if (!paymentMethod) {
      return {
        success: false as const,
        message: "Payment method is required when finalizing draft as paid",
      };
    }

    const paidBy = toValidExpensePaidBy(params.payload.paidBy);
    if (!paidBy) {
      return {
        success: false as const,
        message: "Paid by is required when finalizing draft as paid",
      };
    }

    const paidAt = toDateOrNull(params.payload.paidAt) || new Date();

    const remainingToSettleCents = computeRemainingBalanceCents(
      amountInclVatCents,
      paymentSummary.amountPaidCents
    );

    if (remainingToSettleCents > 0) {
      const createdActivationLine = await ExpensePaymentLine.create({
        companyId: params.companyId,
        expenseId: params.expenseId,
        amountPaidCents: remainingToSettleCents,
        paidAt,
        paymentMethod,
        paidBy,
        createdBy: params.updatedBy,
        source: "settle_expense",
      });
      activationPaymentLineId = String(createdActivationLine._id);

      const refreshedPaymentLines = await listExpensePaymentLines({
        companyId: params.companyId,
        expenseId: params.expenseId,
      });

      effectivePaymentSummary = summarizeExpensePayments({
        amountInclVatCents,
        paymentLines: refreshedPaymentLines,
      });
    }

    if (effectivePaymentSummary.paymentStatus !== "paid") {
      return {
        success: false as const,
        message: "Finalize and pay could not settle the expense balance completely",
      };
    }
  }

  const updatePayload: Record<string, unknown> = {
    ...payloadWithoutFinancialConfirmation,
    status,
    amountExclVatCents,
    vatRate,
    vatAmountCents,
    amountInclVatCents,
    amountPaidCents: effectivePaymentSummary.amountPaidCents,
    paymentStatus: effectivePaymentSummary.paymentStatus,
    paymentMethod: effectivePaymentSummary.paymentMethod,
    paidBy: effectivePaymentSummary.paidBy,
    paidAt: effectivePaymentSummary.paidAt,
    updatedBy: params.updatedBy,
  };

  let updated: Record<string, unknown> | null = null;

  try {
    updated = await Expense.findOneAndUpdate(
      scopedQuery,
      { $set: updatePayload },
      { returnDocument: "after", runValidators: true }
    ).lean<Record<string, unknown> | null>();
  } catch (updateError) {
    if (activationPaymentLineId) {
      await ExpensePaymentLine.deleteOne({
        _id: activationPaymentLineId,
        companyId: params.companyId,
        expenseId: params.expenseId,
      });
    }
    throw updateError;
  }

  if (!updated) {
    if (activationPaymentLineId) {
      await ExpensePaymentLine.deleteOne({
        _id: activationPaymentLineId,
        companyId: params.companyId,
        expenseId: params.expenseId,
      });
    }
    return { success: false as const, message: "Expense not found after update" };
  }

  await recordEntityFieldDiff({
    entityType: "expense",
    entityId: params.expenseId,
    companyId: params.companyId,
    performedBy: params.updatedBy,
    previous: existing,
    next: updated,
    source: "api",
    ipAddress: params.ipAddress,
  });

  await syncAttachmentDisplayNames({
    companyId: params.companyId,
    expenseId: params.expenseId,
    expense: {
      supplierId: updated.supplierId,
      supplierRef: typeof updated.supplierRef === "string" ? updated.supplierRef : null,
      expenseDate: (updated.expenseDate as Date | null) ?? null,
      amountInclVatCents:
        typeof updated.amountInclVatCents === "number"
          ? updated.amountInclVatCents
          : Number(updated.amountInclVatCents || 0),
    },
  });

  return {
    success: true as const,
    expense: {
      ...updated,
      remainingBalanceCents: buildRemainingBalance(updated),
    },
  };
}

export async function archiveExpense(params: {
  companyId: string;
  expenseId: string;
  updatedBy: string;
  access?: AccessScope;
  ipAddress?: string | null;
}) {
  await ConnectDb();

  const scopedQuery = addAccessScopeToQuery(
    { _id: params.expenseId, companyId: params.companyId, deletedAt: null },
    params.access
  );

  const updated = await Expense.findOneAndUpdate(
    scopedQuery,
    {
      $set: {
        status: "archived",
        archivedAt: new Date(),
        updatedBy: params.updatedBy,
      },
    },
    { returnDocument: "after" }
  ).lean();

  if (!updated) {
    return { success: false as const, message: "Expense not found" };
  }

  await recordAuditLog({
    entityType: "expense",
    entityId: params.expenseId,
    companyId: params.companyId,
    action: "archived",
    performedBy: params.updatedBy,
    source: "api",
    ipAddress: params.ipAddress,
  });

  return { success: true as const, expense: updated };
}

export async function deleteDraftExpense(params: {
  companyId: string;
  expenseId: string;
  updatedBy: string;
  access?: AccessScope;
  ipAddress?: string | null;
}) {
  await ConnectDb();

  const scopedQuery = addAccessScopeToQuery(
    {
      _id: params.expenseId,
      companyId: params.companyId,
      status: "draft",
      deletedAt: null,
    },
    params.access
  );

  const now = new Date();
  const deleted = await Expense.findOneAndUpdate(
    scopedQuery,
    {
      $set: {
        deletedAt: now,
        updatedBy: params.updatedBy,
      },
    },
    { returnDocument: "after" }
  ).lean();

  if (!deleted) {
    return { success: false as const, message: "Draft expense not found" };
  }

  await ExpensePaymentLine.deleteMany({
    companyId: params.companyId,
    expenseId: params.expenseId,
  });

  await recordAuditLog({
    entityType: "expense",
    entityId: params.expenseId,
    companyId: params.companyId,
    action: "deleted",
    fieldName: "lifecycle",
    oldValue: {
      status: deleted.status,
      paymentStatus: deleted.paymentStatus,
      amountInclVatCents: toPositiveCents(deleted.amountInclVatCents),
      amountPaidCents: toPositiveCents(deleted.amountPaidCents),
      supplierRef: typeof deleted.supplierRef === "string" ? deleted.supplierRef : null,
      deleteMode: "draft",
    },
    newValue: {
      deletedAt: now,
      status: "deleted",
    },
    performedBy: params.updatedBy,
    source: "api",
    ipAddress: params.ipAddress,
  });

  return { success: true as const, expense: deleted };
}

export async function softDeleteExpense(params: {
  companyId: string;
  expenseId: string;
  updatedBy: string;
  deleteReason: string;
  access?: AccessScope;
  ipAddress?: string | null;
}) {
  await ConnectDb();

  const deleteReason = typeof params.deleteReason === "string" ? params.deleteReason.trim() : "";
  if (deleteReason.length < 10) {
    return {
      success: false as const,
      message: "Deletion reason must contain at least 10 characters",
    };
  }

  const scopedQuery = addAccessScopeToQuery(
    { _id: params.expenseId, companyId: params.companyId, deletedAt: null },
    params.access
  );

  const now = new Date();
  const deleted = await Expense.findOneAndUpdate(
    scopedQuery,
    {
      $set: {
        deletedAt: now,
        updatedBy: params.updatedBy,
      },
    },
    { returnDocument: "after" }
  ).lean();

  if (!deleted) {
    return { success: false as const, message: "Expense not found" };
  }

  await ExpensePaymentLine.deleteMany({
    companyId: params.companyId,
    expenseId: params.expenseId,
  });

  await recordAuditLog({
    entityType: "expense",
    entityId: params.expenseId,
    companyId: params.companyId,
    action: "deleted",
    fieldName: "lifecycle",
    oldValue: {
      status: deleted.status,
      paymentStatus: deleted.paymentStatus,
      amountInclVatCents: toPositiveCents(deleted.amountInclVatCents),
      amountPaidCents: toPositiveCents(deleted.amountPaidCents),
      supplierRef: typeof deleted.supplierRef === "string" ? deleted.supplierRef : null,
      deleteReason,
      passwordConfirmed: true,
    },
    newValue: {
      deletedAt: now,
      status: "deleted",
    },
    performedBy: params.updatedBy,
    source: "api",
    ipAddress: params.ipAddress,
  });

  return { success: true as const, expense: deleted };
}

export async function duplicateExpense(params: {
  companyId: string;
  expenseId: string;
  duplicatedBy: string;
  access?: AccessScope;
  copyAttachments?: boolean;
  ipAddress?: string | null;
}) {
  await ConnectDb();

  const scopedQuery = addAccessScopeToQuery(
    {
      _id: params.expenseId,
      companyId: params.companyId,
      deletedAt: null,
    },
    params.access
  );

  const source = await Expense.findOne(scopedQuery).lean<Record<string, unknown> | null>();

  if (!source) {
    return { success: false as const, message: "Expense not found" };
  }

  if (source.status === "archived") {
    return {
      success: false as const,
      message: "Archived expenses are read-only and cannot be duplicated",
    };
  }

  const clonePayload: Record<string, unknown> = {
    companyId: source.companyId,
    status: canActivateExpense({
      amountInclVatCents: Number(source.amountInclVatCents || 0),
      expenseDate: (source.expenseDate as Date | null) ?? null,
      categoryId: source.categoryId,
    })
      ? "active"
      : "draft",
    // Always reset financial settlement fields on duplicate to prevent accounting duplication.
    paymentStatus: "unpaid",
    amountExclVatCents: source.amountExclVatCents,
    vatRate: source.vatRate,
    vatAmountCents: source.vatAmountCents,
    amountInclVatCents: source.amountInclVatCents,
    expenseDate: source.expenseDate,
    supplierId: source.supplierId,
    categoryId: source.categoryId,
    paymentMethod: null,
    paidBy: null,
    amountPaidCents: 0,
    paidAt: null,
    dueDate: source.dueDate,
    supplierRef: buildDuplicatedSupplierReference(source.supplierRef),
    expenseType: source.expenseType,
    notes: source.notes,
    clientId: source.clientId,
    projectId: source.projectId,
    invoiceId: source.invoiceId,
    createdBy: params.duplicatedBy,
    updatedBy: params.duplicatedBy,
    isDuplicate: true,
    duplicatedFromExpenseId: source._id,
    duplicatedAt: new Date(),
    archivedAt: null,
    deletedAt: null,
  };

  const created = await Expense.create(clonePayload);

  if (params.copyAttachments) {
    const sourceAttachments = await ExpenseAttachment.find({
      companyId: params.companyId,
      expenseId: params.expenseId,
    }).lean();

    if (sourceAttachments.length > 0) {
      await ExpenseAttachment.insertMany(
        sourceAttachments.map((attachment) => ({
          companyId: attachment.companyId,
          expenseId: created._id,
          uploadedBy: params.duplicatedBy,
          originalName: attachment.originalName,
          displayName: attachment.displayName,
          mimeType: attachment.mimeType,
          extension: attachment.extension,
          sizeBytes: attachment.sizeBytes,
          storageKey: attachment.storageKey,
          url: attachment.url,
          checksum: attachment.checksum,
        }))
      );
    }
  }

  await syncAttachmentDisplayNames({
    companyId: params.companyId,
    expenseId: String(created._id),
    expense: {
      supplierId: created.supplierId,
      supplierRef: created.supplierRef,
      expenseDate: created.expenseDate,
      amountInclVatCents: created.amountInclVatCents,
    },
  });

  await recordAuditLog({
    entityType: "expense",
    entityId: String(created._id),
    companyId: params.companyId,
    action: "duplicated",
    performedBy: params.duplicatedBy,
    source: "api",
    ipAddress: params.ipAddress,
  });

  return {
    success: true as const,
    expense: {
      ...created.toObject(),
      remainingBalanceCents: buildRemainingBalance(created),
    },
  };
}

export async function markExpensePaid(params: {
  companyId: string;
  expenseId: string;
  updatedBy: string;
  payload: MarkExpensePaidDTO;
  access?: AccessScope;
  ipAddress?: string | null;
}) {
  await ConnectDb();

  const scopedQuery = addAccessScopeToQuery(
    {
      _id: params.expenseId,
      companyId: params.companyId,
      deletedAt: null,
    },
    params.access
  );

  const expense = await Expense.findOne(scopedQuery);

  if (!expense) {
    return { success: false as const, message: "Expense not found" };
  }

  if (expense.status === "archived") {
    return {
      success: false as const,
      message: "Archived expenses are read-only and cannot receive payments",
    };
  }

  const totalAmountCents = toPositiveCents(expense.amountInclVatCents);
  if (!isExpenseReadyForPayment({
    status: typeof expense.status === "string" ? expense.status : null,
    amountInclVatCents: totalAmountCents,
    expenseDate: expense.expenseDate ?? null,
    categoryId: expense.categoryId,
  })) {
    return { success: false as const, message: "Please complete the expense first." };
  }

  const paymentLines = await ensureLegacyPaymentLines({
    companyId: params.companyId,
    expense: expense.toObject() as Record<string, unknown>,
    fallbackCreatedBy: params.updatedBy,
  });

  const currentSummary = summarizeExpensePayments({
    amountInclVatCents: totalAmountCents,
    paymentLines,
  });
  const remainingCents = computeRemainingBalanceCents(totalAmountCents, currentSummary.amountPaidCents);

  if (remainingCents <= 0) {
    return { success: false as const, message: "Expense is already fully paid" };
  }

  await ExpensePaymentLine.create({
    companyId: params.companyId,
    expenseId: params.expenseId,
    amountPaidCents: remainingCents,
    paidAt: params.payload.paidAt,
    paymentMethod: toValidExpensePaymentMethod(params.payload.paymentMethod),
    paidBy: toValidExpensePaidBy(params.payload.paidBy),
    createdBy: params.updatedBy,
    source: "settle_expense",
  });

  const refreshedPaymentLines = await listExpensePaymentLines({
    companyId: params.companyId,
    expenseId: params.expenseId,
  });
  const paymentSummary = summarizeExpensePayments({
    amountInclVatCents: totalAmountCents,
    paymentLines: refreshedPaymentLines,
  });

  applyExpensePaymentSummary(expense, paymentSummary);
  expense.updatedBy = toObjectId(params.updatedBy);

  await expense.save();

  await recordAuditLog({
    entityType: "expense",
    entityId: params.expenseId,
    companyId: params.companyId,
    action: "marked_paid",
    fieldName: "payments",
    oldValue: {
      paymentStatus: currentSummary.paymentStatus,
    },
    newValue: {
      amountPaidCents: remainingCents,
      paidAt: params.payload.paidAt,
      paymentMethod: params.payload.paymentMethod,
      paidBy: params.payload.paidBy,
      paymentStatus: paymentSummary.paymentStatus,
    },
    performedBy: params.updatedBy,
    source: "api",
    ipAddress: params.ipAddress,
  });

  return {
    success: true as const,
    expense: {
      ...expense.toObject(),
      remainingBalanceCents: buildRemainingBalance(expense),
    },
  };
}

export async function addExpensePayment(params: {
  companyId: string;
  expenseId: string;
  updatedBy: string;
  payload: AddExpensePaymentDTO;
  access?: AccessScope;
  ipAddress?: string | null;
}) {
  await ConnectDb();

  const scopedQuery = addAccessScopeToQuery(
    {
      _id: params.expenseId,
      companyId: params.companyId,
      deletedAt: null,
    },
    params.access
  );

  const expense = await Expense.findOne(scopedQuery);

  if (!expense) {
    return { success: false as const, message: "Expense not found" };
  }

  if (expense.status === "archived") {
    return {
      success: false as const,
      message: "Archived expenses are read-only and cannot receive payments",
    };
  }

  const totalAmountCents = toPositiveCents(expense.amountInclVatCents);
  if (!isExpenseReadyForPayment({
    status: typeof expense.status === "string" ? expense.status : null,
    amountInclVatCents: totalAmountCents,
    expenseDate: expense.expenseDate ?? null,
    categoryId: expense.categoryId,
  })) {
    return { success: false as const, message: "Please complete the expense first." };
  }

  const paymentLines = await ensureLegacyPaymentLines({
    companyId: params.companyId,
    expense: expense.toObject() as Record<string, unknown>,
    fallbackCreatedBy: params.updatedBy,
  });

  const currentSummary = summarizeExpensePayments({
    amountInclVatCents: totalAmountCents,
    paymentLines,
  });
  const remainingCents = computeRemainingBalanceCents(totalAmountCents, currentSummary.amountPaidCents);

  if (remainingCents <= 0) {
    return { success: false as const, message: "Expense is already fully paid" };
  }

  const paymentAmountCents = toPositiveCents(params.payload.amountPaidCents);
  if (paymentAmountCents <= 0) {
    return { success: false as const, message: "Payment amount must be greater than zero" };
  }

  if (paymentAmountCents > remainingCents) {
    return { success: false as const, message: "Payment amount exceeds remaining balance" };
  }

  await ExpensePaymentLine.create({
    companyId: params.companyId,
    expenseId: params.expenseId,
    amountPaidCents: paymentAmountCents,
    paidAt: params.payload.paidAt,
    paymentMethod: toValidExpensePaymentMethod(params.payload.paymentMethod),
    paidBy: toValidExpensePaidBy(params.payload.paidBy),
    createdBy: params.updatedBy,
    source: "add_payment",
  });

  const refreshedPaymentLines = await listExpensePaymentLines({
    companyId: params.companyId,
    expenseId: params.expenseId,
  });
  const paymentSummary = summarizeExpensePayments({
    amountInclVatCents: totalAmountCents,
    paymentLines: refreshedPaymentLines,
  });

  applyExpensePaymentSummary(expense, paymentSummary);
  expense.updatedBy = toObjectId(params.updatedBy);

  await expense.save();

  await recordAuditLog({
    entityType: "expense",
    entityId: params.expenseId,
    companyId: params.companyId,
    action: "payment_added",
    fieldName: "payments",
    oldValue: {
      paymentStatus: currentSummary.paymentStatus,
    },
    newValue: {
      amountPaidCents: paymentAmountCents,
      paidAt: params.payload.paidAt,
      paymentMethod: params.payload.paymentMethod,
      paidBy: params.payload.paidBy,
      paymentStatus: paymentSummary.paymentStatus,
    },
    performedBy: params.updatedBy,
    source: "api",
    ipAddress: params.ipAddress,
  });

  return {
    success: true as const,
    expense: {
      ...expense.toObject(),
      remainingBalanceCents: buildRemainingBalance(expense),
    },
  };
}

export async function listExpenseAttachments(params: {
  companyId: string;
  expenseId: string;
  access?: AccessScope;
}) {
  await ConnectDb();

  if (!isValidObjectId(params.companyId) || !isValidObjectId(params.expenseId)) {
    return { success: false as const, message: "Invalid expense context" };
  }

  const expenseQuery = addAccessScopeToQuery(
    {
      _id: params.expenseId,
      companyId: params.companyId,
      deletedAt: null,
    },
    params.access
  );

  const expense = await Expense.findOne(expenseQuery).select("_id status").lean();
  if (!expense) {
    return { success: false as const, message: "Expense not found" };
  }

  const attachments = await ExpenseAttachment.find({
    companyId: params.companyId,
    expenseId: params.expenseId,
  })
    .sort({ createdAt: -1 })
    .lean();

  return {
    success: true as const,
    attachments,
  };
}

export async function createExpenseAttachment(params: {
  companyId: string;
  expenseId: string;
  uploadedBy: string;
  payload: ExpenseAttachmentMetadataDTO;
  access?: AccessScope;
  ipAddress?: string | null;
}) {
  await ConnectDb();

  if (
    !isValidObjectId(params.companyId) ||
    !isValidObjectId(params.expenseId) ||
    !isValidObjectId(params.uploadedBy)
  ) {
    return { success: false as const, message: "Invalid attachment context" };
  }

  const expenseQuery = addAccessScopeToQuery(
    {
      _id: params.expenseId,
      companyId: params.companyId,
      deletedAt: null,
    },
    params.access
  );

  const expense = await Expense.findOne(expenseQuery)
    .select("supplierId supplierRef expenseDate amountInclVatCents status")
    .lean<AttachmentNamingExpense | null>();

  if (!expense) {
    return { success: false as const, message: "Expense not found" };
  }

  if (expense.status === "archived") {
    return {
      success: false as const,
      message: "Archived expenses are read-only and cannot receive new attachments",
    };
  }

  const displayName = await buildAttachmentDisplayName({
    expense,
    extension: params.payload.extension,
    fallbackName: params.payload.displayName,
  });

  const attachment = await ExpenseAttachment.create({
    companyId: params.companyId,
    expenseId: params.expenseId,
    uploadedBy: params.uploadedBy,
    originalName: params.payload.originalName,
    displayName,
    mimeType: params.payload.mimeType,
    extension: normalizeExtension(params.payload.extension, params.payload.originalName),
    sizeBytes: params.payload.sizeBytes,
    storageKey: params.payload.storageKey,
    url: params.payload.url,
    checksum: params.payload.checksum ?? null,
  });

  await syncAttachmentDisplayNames({
    companyId: params.companyId,
    expenseId: params.expenseId,
    expense,
  });

  const refreshed = await ExpenseAttachment.findById(attachment._id).lean();

  await recordAuditLog({
    entityType: "expense",
    entityId: params.expenseId,
    companyId: params.companyId,
    action: "updated",
    fieldName: "attachments",
    oldValue: null,
    newValue: {
      changeType: "added",
      attachmentId: String(attachment._id),
      displayName: refreshed?.displayName || attachment.displayName,
    },
    performedBy: params.uploadedBy,
    source: "api",
    ipAddress: params.ipAddress,
  });

  return {
    success: true as const,
    attachment: refreshed || attachment.toObject(),
  };
}

export async function deleteExpenseAttachment(params: {
  companyId: string;
  expenseId: string;
  attachmentId: string;
  reason: ExpenseAttachmentDeleteReason;
  reasonDetails?: string | null;
  deletedBy: string;
  access?: AccessScope;
  ipAddress?: string | null;
}) {
  await ConnectDb();

  if (
    !isValidObjectId(params.companyId) ||
    !isValidObjectId(params.expenseId) ||
    !isValidObjectId(params.attachmentId) ||
    !isValidObjectId(params.deletedBy)
  ) {
    return { success: false as const, message: "Invalid attachment context" };
  }

  const reason = toValidAttachmentDeleteReason(params.reason);
  if (!reason) {
    return { success: false as const, message: "Invalid attachment deletion reason" };
  }

  const reasonDetails = typeof params.reasonDetails === "string" ? params.reasonDetails.trim() : "";
  if (reason === "other" && reasonDetails.length < 10) {
    return {
      success: false as const,
      message: "Reason details are required when attachment deletion reason is 'other'",
    };
  }

  const expenseQuery = addAccessScopeToQuery(
    {
      _id: params.expenseId,
      companyId: params.companyId,
      deletedAt: null,
    },
    params.access
  );

  const expense = await Expense.findOne(expenseQuery).select("_id status").lean();
  if (!expense) {
    return { success: false as const, message: "Expense not found" };
  }

  if ((expense as { status?: string | null }).status === "archived") {
    return {
      success: false as const,
      message: "Archived expenses are read-only and attachments cannot be removed",
    };
  }

  const deletedAttachment = await ExpenseAttachment.findOneAndDelete({
    _id: params.attachmentId,
    companyId: params.companyId,
    expenseId: params.expenseId,
  }).lean();

  if (!deletedAttachment) {
    return { success: false as const, message: "Attachment not found" };
  }

  await recordAuditLog({
    entityType: "expense",
    entityId: params.expenseId,
    companyId: params.companyId,
    action: "updated",
    fieldName: "attachments",
    oldValue: {
      changeType: "removed",
      attachmentId: String(deletedAttachment._id),
      displayName: deletedAttachment.displayName,
      deletionReason: reason,
      deletionReasonDetails: reason === "other" ? reasonDetails : null,
    },
    newValue: null,
    performedBy: params.deletedBy,
    source: "api",
    ipAddress: params.ipAddress,
  });

  return {
    success: true as const,
    attachment: deletedAttachment,
  };
}

export async function restoreArchivedExpense(params: {
  companyId: string;
  expenseId: string;
  updatedBy: string;
  updatedByRole?: string | null;
  access?: AccessScope;
  ipAddress?: string | null;
}) {
  await ConnectDb();

  if (
    !isValidObjectId(params.companyId) ||
    !isValidObjectId(params.expenseId) ||
    !isValidObjectId(params.updatedBy)
  ) {
    return { success: false as const, message: "Invalid expense restore context" };
  }

  if (!canRestoreArchivedWithRole(params.updatedByRole)) {
    return { success: false as const, message: "Forbidden" };
  }

  const scopedQuery = addAccessScopeToQuery(
    {
      _id: params.expenseId,
      companyId: params.companyId,
      deletedAt: null,
      status: "archived",
    },
    params.access
  );

  const restored = await Expense.findOneAndUpdate(
    scopedQuery,
    {
      $set: {
        status: "active",
        archivedAt: null,
        updatedBy: params.updatedBy,
      },
    },
    { returnDocument: "after" }
  ).lean();

  if (!restored) {
    return { success: false as const, message: "Archived expense not found" };
  }

  await recordAuditLog({
    entityType: "expense",
    entityId: params.expenseId,
    companyId: params.companyId,
    action: "status_changed",
    fieldName: "status",
    oldValue: "archived",
    newValue: "active",
    performedBy: params.updatedBy,
    source: "api",
    ipAddress: params.ipAddress,
  });

  return { success: true as const, expense: restored };
}
