import { NextResponse } from 'next/server';

import { listAccountantPortalLookups } from '@/db/repository/accountant-portal';
import { authorizeCompanyExportRoute } from '@/app/api/exports/_shared';

export async function GET() {
  try {
    const auth = await authorizeCompanyExportRoute();
    if (!auth.success) {
      return auth.response;
    }

    const result = await listAccountantPortalLookups({ companyId: auth.user.companyId });
    if (!result.success) {
      return NextResponse.json(result, { status: result.status });
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error('GET /api/exports/lookups failed', error);
    return NextResponse.json(
      { success: false, message: `Error fetching export lookups: ${String(error)}` },
      { status: 500 }
    );
  }
}