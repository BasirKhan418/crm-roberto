import { NextResponse } from 'next/server';

import ConnectDb from '@/db/connectDb';
import { ensureInvoiceIndexes } from '@/db/repository/ensureInvoiceIndexes';
import { getNextInvoiceNumberForYear } from '@/lib/invoice-number';
import { requireModulePermission } from '@/lib/role-matrix';
import getMe from '@/utils/middlewares/useMe';

export async function GET() {
  try {
    const me = await getMe(true);
    if (!me.success || !me.user) {
      return NextResponse.json({ message: me.message || 'Unauthorized' }, { status: 401 });
    }

    const permission = await requireModulePermission({ companyId: me.user.companyId, role: me.user.role, moduleKey: 'invoices', action: 'create' });
    if (!permission.success) {
      return NextResponse.json({ message: permission.message }, { status: permission.status });
    }

    await ConnectDb();
    await ensureInvoiceIndexes();

    const year = new Date().getFullYear();
    const invoiceNumber = await getNextInvoiceNumberForYear(me.user.id, year);

    return NextResponse.json({ invoiceNumber });
  } catch (error) {
    return NextResponse.json(
      { message: `Error generating next invoice number: ${String(error)}` },
      { status: 500 }
    );
  }
}
