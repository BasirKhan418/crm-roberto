import { NextRequest, NextResponse } from "next/server";

import { getAdminSession } from "@/app/api/admin/_shared";
import { getCompanyDetail, updateCompanyFeatureFlags, updateCompanyStatus } from "@/db/repository/super-admin";
import { getClientIp } from "@/utils/api/request";
import { buildValidationError } from "@/utils/api/validation";
import {
  companyIdParamsSchema,
  updateCompanyFeatureFlagsSchema,
  updateCompanyStatusSchema,
} from "@/validators/super-admin.schema";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const session = await getAdminSession();
  if (!session.success) {
    return session.response;
  }

  const parsedParams = companyIdParamsSchema.safeParse(await params);
  if (!parsedParams.success) {
    return NextResponse.json(buildValidationError(parsedParams.error), { status: 400 });
  }

  const result = await getCompanyDetail(parsedParams.data.id);
  return NextResponse.json(result, { status: result.success ? 200 : result.status });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await getAdminSession();
  if (!session.success) {
    return session.response;
  }

  const parsedParams = companyIdParamsSchema.safeParse(await params);
  if (!parsedParams.success) {
    return NextResponse.json(buildValidationError(parsedParams.error), { status: 400 });
  }

  const body = await request.json();
  if (body?.status) {
    const parsed = updateCompanyStatusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(buildValidationError(parsed.error), { status: 400 });
    }

    const result = await updateCompanyStatus({
      companyId: parsedParams.data.id,
      status: parsed.data.status,
      performedBy: session.admin.sub,
      ipAddress: getClientIp(request),
    });

    return NextResponse.json(result, { status: result.success ? 200 : result.status });
  }

  const parsed = updateCompanyFeatureFlagsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(buildValidationError(parsed.error), { status: 400 });
  }

  const result = await updateCompanyFeatureFlags({
    companyId: parsedParams.data.id,
    featureFlags: parsed.data.featureFlags,
    performedBy: session.admin.sub,
    ipAddress: getClientIp(request),
  });

  return NextResponse.json(result, { status: result.success ? 200 : result.status });
}