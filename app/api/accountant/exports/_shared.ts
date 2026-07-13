import { NextRequest, NextResponse } from "next/server";

import { accountantExportQuerySchema, type AccountantExportQueryDTO } from "@/validators/accountant-export.schema";
import { buildValidationError } from "@/utils/api/validation";
import { parseFinancialPeriodSearchParams } from "@/lib/financial-periods";

export function parseAccountantExportRequest(request: NextRequest):
  | { success: true; data: AccountantExportQueryDTO & { period: ReturnType<typeof parseFinancialPeriodSearchParams> | null } }
  | { success: false; response: NextResponse } {
  const parsed = accountantExportQuerySchema.safeParse({
    format: request.nextUrl.searchParams.get("format") || undefined,
    type: request.nextUrl.searchParams.get("type") || undefined,
    locale: request.nextUrl.searchParams.get("locale") || undefined,
    status: request.nextUrl.searchParams.get("status") || undefined,
    categoryId: request.nextUrl.searchParams.get("categoryId") || undefined,
  });

  if (!parsed.success) {
    return {
      success: false,
      response: NextResponse.json(buildValidationError(parsed.error), { status: 400 }),
    };
  }

  const hasPeriod = ["period", "year", "month", "quarter", "startDate", "endDate"].some((key) =>
    request.nextUrl.searchParams.has(key)
  );

  return {
    success: true,
    data: {
      ...parsed.data,
      period: hasPeriod ? parseFinancialPeriodSearchParams(request.nextUrl.searchParams) : null,
    },
  };
}