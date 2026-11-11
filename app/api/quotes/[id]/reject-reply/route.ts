import { NextRequest, NextResponse } from 'next/server';

import ConnectDb from '@/db/connectDb';
import Quote from '@/db/models/Quote';
import { resolveCompanyOwnerUserId } from '@/db/repository/company-owner';
import { getCompanyProfileByUserId } from '@/db/repository/cprofile';
import { getQuoteById } from '@/db/repository/quote';
import { sendRejectionReplyToClient } from '@/lib/email';
import { buildQuoteConversation } from '@/lib/quote-conversation';
import { authorizeCompanyRoute } from '@/lib/company-route-access';

export const runtime = 'nodejs';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    await ConnectDb();

    const access = await authorizeCompanyRoute({ moduleKey: 'quotes', action: 'manage' });
    if (!access.success) {
      return access.response;
    }
    const { user } = access;
    const quoteScope = access.scope('user');

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

    const quote = await getQuoteById(access.companyUserIds.map(String), id);
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

    const companyResult = await getCompanyProfileByUserId(await resolveCompanyOwnerUserId({ userId: user.id, companyId: user.companyId }));
    const company = companyResult.success ? (companyResult.profile as Record<string, unknown>) : null;
    const companyName =
      (company?.companyName as string | undefined) ||
      (company?.ownerName as string | undefined) ||
      'CRM';

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
    const rejectedSignToken = quote.rejectedSignToken;
    const signPageUrl =
      appUrl && rejectedSignToken ? `${appUrl}/sign/${rejectedSignToken}` : undefined;

    const now = new Date();

    const updated = await Quote.findOneAndUpdate(
      { _id: id, ...quoteScope },
      {
        $set: { adminReplyMessage: message },
        $push: { conversationMessages: { role: 'admin', text: message, sentAt: now } },
      },
      { returnDocument: 'after', strict: false }
    );

    if (!updated) {
      return NextResponse.json({ success: false, message: 'Quote not found or could not be updated' }, { status: 404 });
    }

    await Quote.updateOne(
      { _id: id, ...quoteScope, rejectionAcknowledgedAt: null },
      { $set: { rejectionAcknowledgedAt: now } }
    );

    await sendRejectionReplyToClient({
      to: clientEmail,
      clientName: quote.clientSnapshot.fullName,
      companyName,
      quoteNumber: quote.quoteNumber,
      messageBody: message,
      quoteAdminUrl: signPageUrl,
      locale,
    });

    return NextResponse.json({
      success: true,
      message: 'Reply sent successfully',
      conversationMessages: buildQuoteConversation(
        updated as unknown as {
          rejectionComment?: string | null;
          adminReplyMessage?: string | null;
          conversationMessages?: Array<{ role?: string | null; text?: string | null; sentAt?: Date | string | null }>;
        }
      ),
    });
  } catch (error) {
    console.error('Error sending rejection reply:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to send reply' },
      { status: 500 }
    );
  }
}
