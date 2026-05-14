import mongoose from "mongoose";

import ConnectDb from "@/db/connectDb";
import Expense from "@/db/models/Expense";
import ExpenseAttachment from "@/db/models/ExpenseAttachment";
import Supplier from "@/db/models/Supplier";
import { computeAmountInclVatCents, computeRemainingBalanceCents, computeVatAmountCents } from "@/lib/expense-calculations";
import type { ListQueryOptions, PaginationMeta } from "@/utils/api/query";
import { buildPagination } from "@/utils/api/query";
import type {
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
};

function isValidObjectId(value: string) {
  return mongoose.Types.ObjectId.isValid(value);
}

function toObjectId(value: string) {
  return new mongoose.Types.ObjectId(value);
}

function buildRemainingBalance(expense: {
  amountInclVatCents?: number;
  amountPaidCents?: number;
}) {
  return computeRemainingBalanceCents(expense.amountInclVatCents || 0, expense.amountPaidCents || 0);
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
  supplierId?: unknown;
}) {
  return Boolean(
    (expense.amountInclVatCents || 0) > 0 &&
      expense.expenseDate &&
      expense.categoryId &&
      expense.supplierId
  );
}

function derivePaymentStatus(amountInclVatCents: number, amountPaidCents: number) {
  const remaining = computeRemainingBalanceCents(amountInclVatCents, amountPaidCents);
  if (remaining === 0 && amountInclVatCents > 0) return "paid";
  if (amountPaidCents > 0) return "partial";
  return "unpaid";
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
  const vatRate = params.payload.vatRate || 0;
  const vatAmountCents = computeVatAmountCents(amountExclVatCents, vatRate);
  const amountInclVatCents = computeAmountInclVatCents(amountExclVatCents, vatAmountCents);

  const displayName = await buildAttachmentDisplayName({
    expense: {
      supplierId: params.payload.supplierId ?? null,
      supplierRef: params.payload.supplierRef ?? null,
      expenseDate: params.payload.expenseDate ?? null,
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
    expenseDate: params.payload.expenseDate ?? null,
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
  const amountPaidCents = Math.min(params.payload.amountPaidCents || 0, amountInclVatCents);

  const paymentStatus = params.payload.paymentStatus || derivePaymentStatus(amountInclVatCents, amountPaidCents);

  const created = await Expense.create({
    companyId: params.companyId,
    status: "active",
    paymentStatus,
    amountExclVatCents: params.payload.amountExclVatCents,
    vatRate: params.payload.vatRate,
    vatAmountCents,
    amountInclVatCents,
    expenseDate: params.payload.expenseDate,
    supplierId: params.payload.supplierId,
    categoryId: params.payload.categoryId,
    paymentMethod: params.payload.paymentMethod ?? null,
    amountPaidCents,
    paidAt: params.payload.paidAt ?? null,
    dueDate: params.payload.dueDate ?? null,
    supplierRef: params.payload.supplierRef ?? null,
    expenseType: params.payload.expenseType,
    notes: params.payload.notes ?? null,
    clientId: params.payload.clientId ?? null,
    projectId: params.payload.projectId ?? null,
    invoiceId: params.payload.invoiceId ?? null,
    createdBy: params.createdBy,
    updatedBy: params.createdBy,
  });

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
      .populate("categoryId", "name")
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

  const [attachments, auditLogs] = await Promise.all([
    ExpenseAttachment.find({ companyId: params.companyId, expenseId: params.expenseId })
      .sort({ createdAt: -1 })
      .lean(),
    listAuditLogsForEntity({
      companyId: params.companyId,
      entityType: "expense",
      entityId: params.expenseId,
    }),
  ]);

  return {
    success: true as const,
    expense: {
      ...expense,
      remainingBalanceCents: buildRemainingBalance(expense),
      attachments,
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

  const nextData: Record<string, unknown> = {
    ...existing,
    ...params.payload,
    updatedBy: toObjectId(params.updatedBy),
  };

  const amountExclVatCents =
    typeof nextData.amountExclVatCents === "number" ? nextData.amountExclVatCents : Number(existing.amountExclVatCents || 0);
  const vatRate = typeof nextData.vatRate === "number" ? nextData.vatRate : Number(existing.vatRate || 0);

  const vatAmountCents = computeVatAmountCents(amountExclVatCents, vatRate);
  const amountInclVatCents = computeAmountInclVatCents(amountExclVatCents, vatAmountCents);

  const amountPaidCentsRaw =
    typeof nextData.amountPaidCents === "number"
      ? nextData.amountPaidCents
      : Number(existing.amountPaidCents || 0);
  const amountPaidCents = Math.min(Math.max(0, amountPaidCentsRaw), amountInclVatCents);

  const status = (nextData.status as string) || (existing.status as string);
  const paymentStatus = derivePaymentStatus(amountInclVatCents, amountPaidCents);

  const activateCandidate = {
    amountInclVatCents,
    expenseDate: (nextData.expenseDate as Date | null) ?? null,
    categoryId: nextData.categoryId,
    supplierId: nextData.supplierId,
  };

  if (status === "active" && !canActivateExpense(activateCandidate)) {
    return {
      success: false as const,
      message: "Draft cannot be activated until amount, date, category, and supplier are set",
    };
  }

  const updatePayload: Record<string, unknown> = {
    ...params.payload,
    amountExclVatCents,
    vatRate,
    vatAmountCents,
    amountInclVatCents,
    amountPaidCents,
    paymentStatus,
    updatedBy: params.updatedBy,
  };

  const updated = await Expense.findOneAndUpdate(
    scopedQuery,
    { $set: updatePayload },
    { returnDocument: "after", runValidators: true }
  ).lean<Record<string, unknown> | null>();

  if (!updated) {
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

export async function softDeleteExpense(params: {
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

  await recordAuditLog({
    entityType: "expense",
    entityId: params.expenseId,
    companyId: params.companyId,
    action: "deleted",
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

  const clonePayload: Record<string, unknown> = {
    companyId: source.companyId,
    status: canActivateExpense({
      amountInclVatCents: Number(source.amountInclVatCents || 0),
      expenseDate: (source.expenseDate as Date | null) ?? null,
      categoryId: source.categoryId,
      supplierId: source.supplierId,
    })
      ? "active"
      : "draft",
    paymentStatus: source.paymentStatus,
    amountExclVatCents: source.amountExclVatCents,
    vatRate: source.vatRate,
    vatAmountCents: source.vatAmountCents,
    amountInclVatCents: source.amountInclVatCents,
    expenseDate: source.expenseDate,
    supplierId: source.supplierId,
    categoryId: source.categoryId,
    paymentMethod: source.paymentMethod,
    amountPaidCents: source.amountPaidCents,
    paidAt: source.paidAt,
    dueDate: source.dueDate,
    supplierRef: source.supplierRef,
    expenseType: source.expenseType,
    notes: source.notes,
    clientId: source.clientId,
    projectId: source.projectId,
    invoiceId: source.invoiceId,
    createdBy: params.duplicatedBy,
    updatedBy: params.duplicatedBy,
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

  expense.paymentStatus = "paid";
  expense.amountPaidCents = expense.amountInclVatCents;
  expense.paymentMethod = params.payload.paymentMethod;
  expense.paidAt = params.payload.paidAt;
  expense.updatedBy = toObjectId(params.updatedBy);

  await expense.save();

  await recordAuditLog({
    entityType: "expense",
    entityId: params.expenseId,
    companyId: params.companyId,
    action: "marked_paid",
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

  const expense = await Expense.findOne(expenseQuery).select("_id").lean();
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
    .select("supplierId supplierRef expenseDate amountInclVatCents")
    .lean<AttachmentNamingExpense | null>();

  if (!expense) {
    return { success: false as const, message: "Expense not found" };
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

  const expenseQuery = addAccessScopeToQuery(
    {
      _id: params.expenseId,
      companyId: params.companyId,
      deletedAt: null,
    },
    params.access
  );

  const expense = await Expense.findOne(expenseQuery).select("_id").lean();
  if (!expense) {
    return { success: false as const, message: "Expense not found" };
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
      attachmentId: String(deletedAttachment._id),
      displayName: deletedAttachment.displayName,
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
