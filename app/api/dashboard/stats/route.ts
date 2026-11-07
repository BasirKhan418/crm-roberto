import { NextResponse } from 'next/server';

import { getDashboardStats } from '@/db/repository/dashboard';
import { getCompanyUserObjectIds } from '@/lib/company-scope';
import { requireModulePermission } from '@/lib/role-matrix';
import getMe from '@/utils/middlewares/useMe';

export async function GET() {
  try {
    const me = await getMe(true);

    if (!me.success || !me.user) {
      return NextResponse.json({ message: me.message || 'Unauthorized', success: false }, { status: 401 });
    }

    const permission = await requireModulePermission({ companyId: me.user.companyId, role: me.user.role, moduleKey: 'financialDashboard', action: 'view' });
    if (!permission.success) {
      return NextResponse.json({ message: permission.message, success: false }, { status: permission.status });
    }

    const stats = await getDashboardStats(
      await getCompanyUserObjectIds({ companyId: me.user.companyId, fallbackUserId: me.user.id })
    );
    return NextResponse.json(stats);
  } catch (error) {
    return NextResponse.json(
      { message: `Error loading dashboard stats: ${String(error)}`, success: false },
      { status: 500 }
    );
  }
}
