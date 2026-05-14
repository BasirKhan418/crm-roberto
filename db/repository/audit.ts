import ConnectDb from "@/db/connectDb";
import AuditLog from "@/db/models/AuditLog";
import { buildFieldDiff } from "@/lib/audit";

type AuditAction =
  | "created"
  | "updated"
  | "deleted"
  | "archived"
  | "duplicated"
  | "status_changed"
  | "marked_paid";

type AuditEntity = "expense" | "invoice" | "supplier" | "user" | "ticket";

type AuditSource = "ui" | "api" | "system";

export type AuditInput = {
  entityType: AuditEntity;
  entityId: string;
  companyId: string;
  action: AuditAction;
  performedBy: string;
  fieldName?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string | null;
  source?: AuditSource;
  performedAt?: Date;
};

export async function recordAuditLog(input: AuditInput) {
  await ConnectDb();

  const entry = await AuditLog.create({
    entityType: input.entityType,
    entityId: input.entityId,
    companyId: input.companyId,
    action: input.action,
    fieldName: input.fieldName ?? null,
    oldValue: input.oldValue ?? null,
    newValue: input.newValue ?? null,
    performedBy: input.performedBy,
    ipAddress: input.ipAddress ?? null,
    source: input.source ?? "api",
    performedAt: input.performedAt ?? new Date(),
  });

  return entry.toObject();
}

export async function recordEntityFieldDiff(params: {
  entityType: AuditEntity;
  entityId: string;
  companyId: string;
  performedBy: string;
  previous: Record<string, unknown>;
  next: Record<string, unknown>;
  source?: AuditSource;
  ipAddress?: string | null;
}) {
  const diff = buildFieldDiff(params.previous, params.next);
  if (diff.length === 0) {
    return [];
  }

  await ConnectDb();
  const created = await AuditLog.insertMany(
    diff.map((change) => ({
      entityType: params.entityType,
      entityId: params.entityId,
      companyId: params.companyId,
      action: "updated",
      fieldName: change.fieldName,
      oldValue: change.oldValue,
      newValue: change.newValue,
      performedBy: params.performedBy,
      source: params.source ?? "api",
      ipAddress: params.ipAddress ?? null,
      performedAt: new Date(),
    }))
  );

  return created.map((entry) => entry.toObject());
}

export async function listAuditLogsForEntity(params: {
  companyId: string;
  entityType: AuditEntity;
  entityId: string;
}) {
  await ConnectDb();

  const logs = await AuditLog.find({
    companyId: params.companyId,
    entityType: params.entityType,
    entityId: params.entityId,
  })
    .populate("performedBy", "name email")
    .sort({ performedAt: -1 })
    .lean();

  return logs;
}
