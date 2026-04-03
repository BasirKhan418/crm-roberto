import { NextResponse } from 'next/server';

import ConnectDb from '@/db/connectDb';
import Invoice from '@/db/models/Invoice';
import { nextInvoiceNumber } from '@/lib/price';
import getMe from '@/utils/middlewares/useMe';

export async function GET() {
  try {
    const me = await getMe(true);
    if (!me.success || !me.user) {
      return NextResponse.json({ message: me.message || 'Unauthorized' }, { status: 401 });
    }

    await ConnectDb();

    const year = new Date().getFullYear();
    const yearPrefix = `INV-${year}-`;

    const lastInvoice = await Invoice.findOne({
      userId: me.user.id,
      invoiceNumber: { $regex: `^${yearPrefix}` },
    })
      .sort({ invoiceNumber: -1 })
      .select('invoiceNumber')
      .lean<{ invoiceNumber?: string } | null>();

    const invoiceNumber = nextInvoiceNumber(lastInvoice?.invoiceNumber ?? null, year);

    return NextResponse.json({ invoiceNumber });
  } catch (error) {
    return NextResponse.json(
      { message: `Error generating next invoice number: ${String(error)}` },
      { status: 500 }
    );
  }
}
