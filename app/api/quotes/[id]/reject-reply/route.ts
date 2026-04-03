import { NextRequest, NextResponse } from 'next/server';

import { getCompanyProfileByUserId } from '@/db/repository/cprofile';
import { getQuoteById } from '@/db/repository/quote';
import { sendRejectionReplyToClient } from '@/lib/email';
import getMe from '@/utils/middlewares/useMe';

export const runtime = 'nodejs';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const me = await getMe(true);
    if (!me.success || !me.user) {
      return NextResponse.json({ success: false, message: me.message || 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json() as { message?: string; locale?: string };
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    const locale: 'en' | 'fr' = body.locale === 'fr' ? 'fr' : 'en';

    if (!message) {
      return NextResponse.json({ success: false, message: 'Message is required' }, { status: 400 });
    }

    if (message.length > 2000) {
      return NextResponse.json({ success: false, message: 'Message cannot exceed 2000 characters' }, { status: 400 });
    }

    const { id } = await params;

    const quote = await getQuoteById(me.user.id, id);
    if (!quote) {
      return NextResponse.json({ success: false, message: 'Quote not found' }, { status: 404 });
    }

    if (quote.status !== 'rejected') {
      return NextResponse.json(
        { success: false, message: 'Can only reply to rejected quotes' },
        { status: 403 }
      );
    }

    const clientEmail = quote.clientSnapshot?.email?.trim();
    if (!clientEmail) {
      return NextResponse.json({ success: false, message: 'Client email is not available for this quote' }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(clientEmail)) {
      return NextResponse.json({ success: false, message: 'Invalid client email address' }, { status: 400 });
    }

    const companyResult = await getCompanyProfileByUserId(me.user.id);
    const company = companyResult.success ? (companyResult.profile as Record<string, unknown>) : null;
    const companyName =
      (company?.companyName as string | undefined) ||
      (company?.ownerName as string | undefined) ||
      'CRM';

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
    const quoteAdminUrl = appUrl ? `${appUrl}/quotes/${String(quote._id)}` : undefined;

    await sendRejectionReplyToClient({
      to: clientEmail,
      clientName: quote.clientSnapshot.fullName,
      companyName,
      quoteNumber: quote.quoteNumber,
      messageBody: message,
      quoteAdminUrl,
      locale,
    });

    return NextResponse.json({ success: true, message: 'Reply sent successfully' });
  } catch (error) {
    console.error('Error sending rejection reply:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to send reply' },
      { status: 500 }
    );
  }
}
