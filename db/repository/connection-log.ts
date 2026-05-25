import mongoose from "mongoose";

import ConnectDb from "@/db/connectDb";
import ConnectionLog from "@/db/models/ConnectionLog";

export type ConnectionLogEventType =
  | "login_success"
  | "login_failed"
  | "logout"
  | "portal_login_success"
  | "portal_login_failed"
  | "force_logout";

type CreateConnectionLogParams = {
  userId?: string | null;
  companyId?: string | null;
  role?: string | null;
  eventType: ConnectionLogEventType;
  ipAddress?: string | null;
  userAgent?: string | null;
};

function toObjectIdOrNull(value?: string | null) {
  if (!value || !mongoose.Types.ObjectId.isValid(value)) {
    return null;
  }

  return new mongoose.Types.ObjectId(value);
}

function deriveDeviceLabel(userAgent?: string | null) {
  const normalized = (userAgent || "").toLowerCase();

  if (!normalized) return null;
  if (normalized.includes("iphone") || normalized.includes("android") || normalized.includes("mobile")) {
    return "Mobile browser";
  }
  if (normalized.includes("ipad") || normalized.includes("tablet")) {
    return "Tablet browser";
  }
  if (normalized.includes("edg")) {
    return "Edge browser";
  }
  if (normalized.includes("chrome")) {
    return "Chrome browser";
  }
  if (normalized.includes("firefox")) {
    return "Firefox browser";
  }
  if (normalized.includes("safari")) {
    return "Safari browser";
  }

  return "Browser";
}

export async function createConnectionLog(params: CreateConnectionLogParams) {
  try {
    await ConnectDb();
    await ConnectionLog.create({
      userId: toObjectIdOrNull(params.userId),
      companyId: toObjectIdOrNull(params.companyId),
      role: params.role ?? null,
      eventType: params.eventType,
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
      deviceLabel: deriveDeviceLabel(params.userAgent),
    });

    return { success: true as const };
  } catch (error) {
    console.error("createConnectionLog failed", error);
    return { success: false as const, message: "Failed to create connection log" };
  }
}