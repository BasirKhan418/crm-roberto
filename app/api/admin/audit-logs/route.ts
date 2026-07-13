import { NextRequest, NextResponse } from "next/server";

import { getAdminSession } from "@/app/api/admin/_shared";
import { listPlatformAuditLogs } from "@/db/repository/super-admin";
import { buildValidationError } from "@/utils/api/validation";
import { auditLogsQuerySchema } from "@/validators/super-admin.schema";

export async function GET(request: NextRequest) {
  const session = await getAdminSession();
  if (!session.success) {
    return session.response;
  }

  const parsed = auditLogsQuerySchema.safeParse({
    companyId: request.nextUrl.searchParams.get("companyId") || undefined,
    entityType: request.nextUrl.searchParams.get("entityType") || undefined,
    period: request.nextUrl.searchParams.get("period") || undefined,
    page: request.nextUrl.searchParams.get("page") || undefined,
    limit: request.nextUrl.searchParams.get("limit") || undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(buildValidationError(parsed.error), { status: 400 });
  }

  const result = await listPlatformAuditLogs(parsed.data);
  return NextResponse.json(result, { status: 200 });
}