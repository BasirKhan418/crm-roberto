import mongoose from "mongoose";

import ConnectDb from "@/db/connectDb";
import Expense from "@/db/models/Expense";
import ExpenseAttachment from "@/db/models/ExpenseAttachment";
import { computeAmountInclVatCents, computeRemainingBalanceCents, computeVatAmountCents } from "@/lib/expense-calculations";
import type { ListQueryOptions, PaginationMeta } from "@/utils/api/query";
import { buildPagination } from "@/utils/api/query";
import type {
  CreateDraftExpenseDTO,
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
    displayName: params.payload.attachment.displayName,
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
    query.$or = [
      { supplierRef: { $regex: params.options.search, $options: "i" } },
      { notes: { $regex: params.options.search, $options: "i" } },
    ];
  }

  const skip = (params.options.page - 1) * params.options.limit;

  const [items, total] = await Promise.all([
    Expense.find(query)
      .sort(parseSort(params.options))
      .skip(skip)
      .limit(params.options.limit)
      .lean(),
    Expense.countDocuments(query),
  ]);

  return {
    items: items.map((item) => ({
      ...item,
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
      auditLogs,
    },
  };
}

export async function updateExpense(params: {
  companyId: string;
  expenseId: string;
  updatedBy: string;
  payload: UpdateExpenseDTO;
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

  const existing = await Expense.findOne({
    _id: params.expenseId,
    companyId: params.companyId,
    deletedAt: null,
  }).lean<Record<string, unknown> | null>();

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
    { _id: params.expenseId, companyId: params.companyId, deletedAt: null },
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
  ipAddress?: string | null;
}) {
  await ConnectDb();

  const updated = await Expense.findOneAndUpdate(
    { _id: params.expenseId, companyId: params.companyId, deletedAt: null },
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
  ipAddress?: string | null;
}) {
  await ConnectDb();

  const now = new Date();
  const deleted = await Expense.findOneAndUpdate(
    { _id: params.expenseId, companyId: params.companyId, deletedAt: null },
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
  copyAttachments?: boolean;
  ipAddress?: string | null;
}) {
  await ConnectDb();

  const source = await Expense.findOne({
    _id: params.expenseId,
    companyId: params.companyId,
    deletedAt: null,
  }).lean<Record<string, unknown> | null>();

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
  ipAddress?: string | null;
}) {
  await ConnectDb();

  const expense = await Expense.findOne({
    _id: params.expenseId,
    companyId: params.companyId,
    deletedAt: null,
  });

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
