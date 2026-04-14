import { NextRequest } from "next/server";

import { onActivityChanged } from "@/lib/activity-events";
import getMe from "@/utils/middlewares/useMe";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const me = await getMe(true);
  if (!me.success || !me.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;

      const send = (eventName: string, payload: Record<string, unknown>) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`));
      };

      const close = () => {
        if (closed) return;
        closed = true;
        if (heartbeatTimer) {
          clearInterval(heartbeatTimer);
        }
        unsubscribe();
        controller.close();
      };

      const unsubscribe = onActivityChanged((event) => {
        if (event.userId !== me.user!.id) {
          return;
        }

        send("activity_changed", {
          id: event.eventId,
          type: event.type,
          activityId: event.activityId ?? null,
          at: event.at,
        });
      });

      const heartbeatTimer = setInterval(() => {
        send("ping", { at: Date.now() });
      }, 20000);

      send("connected", { at: Date.now() });

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
