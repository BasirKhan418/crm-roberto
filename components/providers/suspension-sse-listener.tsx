"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";

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

    const init = async () => {
      try {
        const meResponse = await fetch("/api/me", { cache: "no-store" });
        if (disposed || !meResponse.ok) return;

        const data = (await meResponse.json()) as MeResponse;
        if (!data.success) return;

        eventSource = new EventSource("/api/me/events");

        eventSource.addEventListener("suspended", () => {
          void forceLogout();
        });

        eventSource.onerror = () => {
          if (eventSource?.readyState === EventSource.CLOSED) {
            eventSource?.close();
          }
        };
      } catch {
        // No-op: missing auth or temporary network failure.
      }
    };

    void init();

    return () => {
      disposed = true;
      eventSource?.close();
    };
  }, [pathname, router]);

  return null;
}
