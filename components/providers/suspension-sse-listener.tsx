"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";

import { broadcastAuthRefresh } from "@/lib/auth-refresh";

type MeResponse = {
  success?: boolean;
};

export function SuspensionSseListener() {
  const router = useRouter();
  const pathname = usePathname();
  const hasHandledSuspension = useRef(false);

  useEffect(() => {
    if (pathname.startsWith("/admin")) {
      return;
    }

    let eventSource: EventSource | null = null;
    let disposed = false;

    const forceLogout = async () => {
      if (hasHandledSuspension.current) return;
      hasHandledSuspension.current = true;

      toast.error("Your account has been suspended. Please contact support.");

      try {
        await fetch("/api/logout", {
          method: "POST",
          cache: "no-store",
        });
      } finally {
        router.replace("/login?suspended=1");
      }
    };

    const openSource = () => {
      if (disposed || eventSource) return;

      eventSource = new EventSource("/api/me/events");

      eventSource.addEventListener("suspended", () => {
        void forceLogout();
      });

      eventSource.addEventListener("refresh", () => {
        broadcastAuthRefresh();
        router.refresh();
      });

      eventSource.onerror = () => {
        if (eventSource?.readyState === EventSource.CLOSED) {
          eventSource?.close();
          eventSource = null;
        }
      };
    };

    const closeSource = () => {
      eventSource?.close();
      eventSource = null;
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        openSource();
      } else {
        // Close the SSE connection in background tabs so they do not
        // consume scarce HTTP/1.1 connection slots (6 per origin in most
        // browsers). Without this, opening ~3+ tabs queues every other
        // request forever.
        closeSource();
      }
    };

    const init = async () => {
      try {
        const meResponse = await fetch("/api/me", { cache: "no-store" });
        if (disposed || !meResponse.ok) return;

        const data = (await meResponse.json()) as MeResponse;
        if (!data.success) return;

        if (document.visibilityState === "visible") {
          openSource();
        }

        document.addEventListener("visibilitychange", handleVisibilityChange);
      } catch {
        // No-op: missing auth or temporary network failure.
      }
    };

    void init();

    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      closeSource();
    };
  }, [pathname, router]);

  return null;
}
