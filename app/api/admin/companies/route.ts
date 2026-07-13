import { NextRequest, NextResponse } from "next/server";

import { getAdminSession } from "@/app/api/admin/_shared";
import { createCompany, listCompanies } from "@/db/repository/super-admin";
import { getClientIp } from "@/utils/api/request";
import { buildValidationError } from "@/utils/api/validation";
import { createCompanySchema, listCompaniesQuerySchema } from "@/validators/super-admin.schema";

export async function GET(request: NextRequest) {
  const session = await getAdminSession();
  if (!session.success) {
    return session.response;
  }

  const parsed = listCompaniesQuerySchema.safeParse({
    search: request.nextUrl.searchParams.get("search") || undefined,
    status: request.nextUrl.searchParams.get("status") || undefined,
    page: request.nextUrl.searchParams.get("page") || undefined,
    limit: request.nextUrl.searchParams.get("limit") || undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(buildValidationError(parsed.error), { status: 400 });
  }

  const result = await listCompanies(parsed.data);
  return NextResponse.json(result, { status: 200 });
}

export async function POST(request: NextRequest) {
  const session = await getAdminSession();
  if (!session.success) {
    return session.response;
  }

  const body = await request.json();
  const parsed = createCompanySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(buildValidationError(parsed.error), { status: 400 });
  }

  const result = await createCompany({
    ...parsed.data,
    performedBy: session.admin.sub,
    ipAddress: getClientIp(request),
  });

  return NextResponse.json(result, { status: result.success ? 201 : result.status });
}