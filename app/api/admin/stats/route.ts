import { NextResponse } from "next/server";

import { getAdminSession } from "@/app/api/admin/_shared";
import { getPlatformStats } from "@/db/repository/super-admin";

export async function GET() {
  const session = await getAdminSession();
  if (!session.success) {
    return session.response;
  }

  const result = await getPlatformStats();
  return NextResponse.json(result, { status: 200 });
}