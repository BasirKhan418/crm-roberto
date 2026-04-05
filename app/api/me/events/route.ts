import { NextRequest } from "next/server";
import jwt from "jsonwebtoken";

import ConnectDb from "@/db/connectDb";
import User from "@/db/models/User";
import { onAccountStatusChanged } from "@/lib/account-status-events";

type JwtPayload = {
  sub: string;
};

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("token")?.value;
  if (!token) {
    return new Response("Unauthorized", { status: 401 });
  }

  let decoded: JwtPayload;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET || "") as JwtPayload;
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }

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
          const user = await User.findById(decoded.sub)
            .select("account_status")
            .lean<{ account_status?: "active" | "suspended" } | null>();

          if (!user || user.account_status === "suspended") {
            sendEvent("suspended", {
              reason: "account_suspended",
              at: Date.now(),
            });
            close();
          }
        } catch {
          sendEvent("error", { message: "status_check_failed", at: Date.now() });
        }
      };

      unsubscribe = onAccountStatusChanged((event) => {
        if (event.userId !== decoded.sub) return;

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
