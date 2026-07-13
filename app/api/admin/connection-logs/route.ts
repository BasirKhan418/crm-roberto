import { NextRequest, NextResponse } from "next/server";

import { getAdminSession } from "@/app/api/admin/_shared";
import { listConnectionLogs } from "@/db/repository/super-admin";
import { buildValidationError } from "@/utils/api/validation";
import { connectionLogsQuerySchema } from "@/validators/super-admin.schema";

export async function GET(request: NextRequest) {
  const session = await getAdminSession();
  if (!session.success) {
    return session.response;
  }

  const parsed = connectionLogsQuerySchema.safeParse({
    companyId: request.nextUrl.searchParams.get("companyId") || undefined,
    search: request.nextUrl.searchParams.get("search") || undefined,
    period: request.nextUrl.searchParams.get("period") || undefined,
    eventType: request.nextUrl.searchParams.get("eventType") || undefined,
    page: request.nextUrl.searchParams.get("page") || undefined,
    limit: request.nextUrl.searchParams.get("limit") || undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(buildValidationError(parsed.error), { status: 400 });
  }

  const result = await listConnectionLogs(parsed.data);
  return NextResponse.json(result, { status: 200 });
}