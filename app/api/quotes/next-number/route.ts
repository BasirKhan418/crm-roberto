import { NextResponse } from 'next/server';

import { getLastQuoteNumber } from '@/db/repository/quote';
import { nextQuoteNumber } from '@/lib/price';
import getMe from '@/utils/middlewares/useMe';

export async function GET() {
  try {
    const me = await getMe(true);
    if (!me.success || !me.user) {
      return NextResponse.json({ message: me.message || 'Unauthorized' }, { status: 401 });
    }

    const lastQuoteNumber = await getLastQuoteNumber(me.user.id);
    const quoteNumber = nextQuoteNumber(lastQuoteNumber);

    return NextResponse.json({ quoteNumber });
  } catch (error) {
    return NextResponse.json({ message: `Error generating next quote number: ${String(error)}` }, { status: 500 });
  }
}
