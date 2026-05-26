import { NextRequest } from "next/server";

import ConnectDb from "@/db/connectDb";
import Company from "@/db/models/Company";
import RoleMatrix from "@/db/models/RoleMatrix";
import User from "@/db/models/User";
import { onAccountStatusChanged } from "@/lib/account-status-events";
import { createI18nKey as i18nKey } from "@/lib/i18n/messages";
import { normalizeRole } from "@/lib/permissions";
import checkMe from "@/utils/middlewares/checkMe";

type StreamUserProjection = {
  account_status?: "active" | "suspended";
  role?: string;
  companyId?: string | null;
};

type CompanyProjection = {
  featureFlags?: {
    advancedRoles?: boolean;
  } | null;
};

type PermissionSnapshot = {
  accountStatus: "active" | "suspended" | null;
  role: string;
  companyId: string | null;
  advancedRoles: boolean;
  latestRoleMatrixUpdateAt: string | null;
};

async function getPermissionSnapshot(userId: string): Promise<PermissionSnapshot | null> {
  const user = await User.findById(userId)
    .select("account_status role companyId")
    .lean<StreamUserProjection | null>();

  if (!user) {
    return null;
  }

  const role = normalizeRole(user.role);
  const companyId = user.companyId ? String(user.companyId) : null;
  let advancedRoles = false;
  let latestRoleMatrixUpdateAt: string | null = null;

  if (companyId) {
    const company = await Company.findById(companyId)
      .select("featureFlags.advancedRoles")
      .lean<CompanyProjection | null>();

    advancedRoles = company?.featureFlags?.advancedRoles === true;

    if (advancedRoles && role !== "super_admin" && role !== "administrator") {
      const latestRoleMatrixRow = await RoleMatrix.findOne({ companyId, role })
        .sort({ updatedAt: -1 })
        .select("updatedAt")
        .lean<{ updatedAt?: Date | null } | null>();

      latestRoleMatrixUpdateAt = latestRoleMatrixRow?.updatedAt?.toISOString() ?? null;
    }
  }

  return {
    accountStatus: user.account_status ?? null,
    role,
    companyId,
    advancedRoles,
    latestRoleMatrixUpdateAt,
  };
};

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const me = await checkMe(true);
  if (!me.success || !me.user) {
    const forbiddenStateMessages = new Set([
      i18nKey("auth.accountSuspended"),
      i18nKey("auth.accountRevoked"),
      i18nKey("auth.accountTemporarilyLocked"),
      i18nKey("auth.externalAccountantPortalOnly"),
    ]);
    const lowerMessage = typeof me.message === "string" ? me.message.toLowerCase() : "";
    const isForbiddenState =
      (typeof me.message === "string" && forbiddenStateMessages.has(me.message)) ||
      lowerMessage.includes("suspended") ||
      lowerMessage.includes("revoked") ||
      lowerMessage.includes("locked") ||
      lowerMessage.includes("portal");

    return new Response(me.message || "Unauthorized", { status: isForbiddenState ? 403 : 401 });
  }

  const userId = me.user.id;
  const initialSnapshot: PermissionSnapshot = {
    accountStatus: "active",
    role: normalizeRole(me.user.role),
    companyId: me.user.companyId ? String(me.user.companyId) : null,
    advancedRoles: me.user.featureFlags?.advancedRoles === true,
    latestRoleMatrixUpdateAt: null,
  };

  await ConnectDb();

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let heartbeatTimer: NodeJS.Timeout | null = null;
      let statusTimer: NodeJS.Timeout | null = null;
      let unsubscribe: (() => void) | null = null;
      let lastSnapshot = initialSnapshot;

      const sendEvent = (eventName: string, payload: Record<string, unknown>) => {
        if (closed) return;
        const body = `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
        controller.enqueue(encoder.encode(body));
      };

      const close = () => {
        if (closed) return;
        closed = true;

        if (heartbeatTimer) clearInterval(heartbeatTimer);
        if (statusTimer) clearInterval(statusTimer);
        if (unsubscribe) unsubscribe();

        controller.close();
      };

      const checkUserStatus = async () => {
        try {
          const snapshot = await getPermissionSnapshot(userId);

          if (!snapshot || snapshot.accountStatus === "suspended" || snapshot.role === "external_accountant") {
            sendEvent("suspended", {
              reason: snapshot?.role === "external_accountant" ? "access_restricted" : "account_suspended",
              at: Date.now(),
            });
            close();
            return;
          }

          if (
            snapshot.role !== lastSnapshot.role ||
            snapshot.companyId !== lastSnapshot.companyId ||
            snapshot.advancedRoles !== lastSnapshot.advancedRoles ||
            snapshot.latestRoleMatrixUpdateAt !== lastSnapshot.latestRoleMatrixUpdateAt
          ) {
            lastSnapshot = snapshot;
            sendEvent("refresh", {
              reason: "permissions_changed",
              at: Date.now(),
            });
          }
        } catch {
          sendEvent("error", { message: "status_check_failed", at: Date.now() });
        }
      };

      unsubscribe = onAccountStatusChanged((event) => {
        if (event.userId !== userId) return;

        if (event.account_status === "suspended") {
          sendEvent("suspended", {
            reason: "account_suspended",
            at: event.at,
          });
          close();
        }
      });

      heartbeatTimer = setInterval(() => {
        sendEvent("ping", { at: Date.now() });
      }, 20000);

      statusTimer = setInterval(() => {
        void checkUserStatus();
      }, 5000);

      void getPermissionSnapshot(userId).then((snapshot) => {
        if (snapshot) {
          lastSnapshot = snapshot;
        }
        sendEvent("connected", { at: Date.now() });
        void checkUserStatus();
      });

      request.signal.addEventListener("abort", close);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
