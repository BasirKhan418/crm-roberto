import { NextRequest } from "next/server";

import ConnectDb from "@/db/connectDb";
import User from "@/db/models/User";
import { onAccountStatusChanged } from "@/lib/account-status-events";
import { createI18nKey as i18nKey } from "@/lib/i18n/messages";
import checkMe from "@/utils/middlewares/checkMe";

type StreamUserProjection = {
  account_status?: "active" | "suspended";
  role?: string;
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

  await ConnectDb();

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let heartbeatTimer: NodeJS.Timeout | null = null;
      let statusTimer: NodeJS.Timeout | null = null;
      let unsubscribe: (() => void) | null = null;

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
          const user = await User.findById(userId)
            .select("account_status role")
            .lean<StreamUserProjection | null>();

          if (!user || user.account_status === "suspended" || user.role === "external_accountant") {
            sendEvent("suspended", {
              reason: user?.role === "external_accountant" ? "access_restricted" : "account_suspended",
              at: Date.now(),
            });
            close();
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

      sendEvent("connected", { at: Date.now() });
      void checkUserStatus();

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
