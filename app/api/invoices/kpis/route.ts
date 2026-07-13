import { NextResponse } from 'next/server';

import ConnectDb from '@/db/connectDb';
import Invoice from '@/db/models/Invoice';
import { getCompanyUserObjectIds } from '@/lib/company-scope';
import { getStartOfTomorrow } from '@/lib/invoices/overdue';
import { requireModulePermission } from '@/lib/role-matrix';
import getMe from '@/utils/middlewares/useMe';


export async function GET() {
  try {
    const me = await getMe(true);
    if (!me.success || !me.user) {
      return NextResponse.json({ success: false, message: me.message || 'Unauthorized' }, { status: 401 });
    }

    const permission = await requireModulePermission({
      companyId: me.user.companyId,
      role: me.user.role,
      moduleKey: 'invoices',
      action: 'view',
    });
    if (!permission.success) {
      return NextResponse.json({ success: false, message: permission.message }, { status: permission.status });
    }

    await ConnectDb();

    const userObjectIds = await getCompanyUserObjectIds({ companyId: me.user.companyId, fallbackUserId: me.user.id });
    const tomorrowStart = getStartOfTomorrow();

    const [result] = await Invoice.aggregate<{
      all: Array<{ count: number; totalTTC: number }>;
      unpaid: Array<{ count: number; totalTTC: number }>;
      paid: Array<{ count: number; totalTTC: number }>;
      overdue: Array<{ count: number; totalTTC: number }>;
      totals: Array<{ totalHT: number; totalVat: number; totalTTC: number }>;
    }>([
      { $match: { userId: { $in: userObjectIds } } },
      {
        $facet: {
          all: [
            {
              $group: {
                _id: null,
                count: { $sum: 1 },
                totalTTC: { $sum: { $ifNull: ['$totalIncludingTax', 0] } },
              },
            },
          ],
          unpaid: [
            {
              $match: {
                status: 'unpaid',
                // Exclude invoices already counted as overdue so the KPI
                // buckets (unpaid / overdue) are mutually exclusive.
                $or: [
                  { dueDate: null },
                  { dueDate: { $exists: false } },
                  { dueDate: { $gte: tomorrowStart } },
                ],
              },
            },
            {
              $group: {
                _id: null,
                count: { $sum: 1 },
                totalTTC: { $sum: { $ifNull: ['$totalIncludingTax', 0] } },
              },
            },
          ],
          paid: [
            { $match: { status: 'paid' } },
            {
              $group: {
                _id: null,
                count: { $sum: 1 },
                totalTTC: { $sum: { $ifNull: ['$totalIncludingTax', 0] } },
              },
            },
          ],
          overdue: [
            {
              $match: {
                $or: [
                  { status: 'overdue' },
                  {
                    status: { $in: ['unpaid', 'partial_paid'] },
                    dueDate: { $lt: tomorrowStart },
                  },
                ],
              },
            },
            {
              $group: {
                _id: null,
                count: { $sum: 1 },
                totalTTC: { $sum: { $ifNull: ['$totalIncludingTax', 0] } },
              },
            },
          ],
          totals: [
            {
              $group: {
                _id: null,
                totalHT: { $sum: { $ifNull: ['$totalExcludingTax', 0] } },
                totalVat: { $sum: { $ifNull: ['$totalVat', 0] } },
                totalTTC: { $sum: { $ifNull: ['$totalIncludingTax', 0] } },
              },
            },
          ],
        },
      },
    ]);

    const all = result?.all[0] ?? { count: 0, totalTTC: 0 };
    const unpaid = result?.unpaid[0] ?? { count: 0, totalTTC: 0 };
    const paid = result?.paid[0] ?? { count: 0, totalTTC: 0 };
    const overdue = result?.overdue[0] ?? { count: 0, totalTTC: 0 };
    const totals = result?.totals[0] ?? { totalHT: 0, totalVat: 0, totalTTC: 0 };

    return NextResponse.json({
      success: true,
      data: {
        all,
        unpaid,
        paid,
        overdue,
        totals: {
          totalHT: totals.totalHT,
          totalVat: totals.totalVat,
          totalTTC: totals.totalTTC,
        },
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: `Error fetching invoice KPIs: ${String(error)}` },
      { status: 500 },
    );
  }
}
