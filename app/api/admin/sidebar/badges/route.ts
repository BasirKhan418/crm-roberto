import { NextResponse } from 'next/server';

import ConnectDb from '@/db/connectDb';
import Company from '@/db/models/Company';
import ConnectionLog from '@/db/models/ConnectionLog';
import { getAdminSession } from '@/app/api/admin/_shared';

export async function GET() {
  const session = await getAdminSession();
  if (!session.success) {
    return session.response;
  }

  try {
    await ConnectDb();

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [suspendedCount, failedAccessCount] = await Promise.all([
      Company.countDocuments({ deletedAt: null, status: 'suspended' }),
      ConnectionLog.countDocuments({
        eventType: { $in: ['login_failed', 'portal_login_failed'] },
        createdAt: { $gte: since },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        companies: {
          suspendedCount,
        },
        logs: {
          failedAccessCount,
        },
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: `Error fetching admin sidebar badges: ${String(error)}` },
      { status: 500 }
    );
  }
}