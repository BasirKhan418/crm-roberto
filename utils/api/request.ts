import type { NextRequest } from "next/server";

export function getClientIp(request: NextRequest): string | null {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const value = forwardedFor.split(",")[0]?.trim();
    return value || null;
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  return realIp || null;
}
