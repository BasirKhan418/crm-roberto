import { NextResponse } from 'next/server';

import { requireCompanyFeature } from '@/lib/company-features';
import { requireModulePermission } from '@/lib/role-matrix';
import getMe from '@/utils/middlewares/useMe';

export async function authorizeCompanyExportRoute() {
  const me = await getMe(true);

  if (!me.success || !me.user) {
    return {
      success: false as const,
      response: NextResponse.json({ success: false, message: me.message || 'Unauthorized' }, { status: 401 }),
    };
  }

  const featureCheck = await requireCompanyFeature(me.user.companyId, 'exports');
  if (!featureCheck.success) {
    return {
      success: false as const,
      response: NextResponse.json({ success: false, message: featureCheck.message }, { status: featureCheck.status }),
    };
  }

  if (!me.user.companyId) {
    return {
      success: false as const,
      response: NextResponse.json({ success: false, message: 'Missing company context' }, { status: 400 }),
    };
  }

  const permission = await requireModulePermission({
    companyId: me.user.companyId,
    role: me.user.role,
    moduleKey: 'financialDashboard',
    action: 'export',
  });
  if (!permission.success) {
    return {
      success: false as const,
      response: NextResponse.json({ success: false, message: permission.message }, { status: permission.status }),
    };
  }

  return {
    success: true as const,
    user: {
      ...me.user,
      companyId: me.user.companyId,
    },
  };
}