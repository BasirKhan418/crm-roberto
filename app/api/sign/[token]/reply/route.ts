import { NextRequest, NextResponse } from 'next/server';

import ConnectDb from '@/db/connectDb';
import CompanyProfile from '@/db/models/CompanyProfile';
import Quote from '@/db/models/Quote';
import User from '@/db/models/User';
import { createActivityLog } from '@/db/repository/activity';
import { sendClientReplyNotificationToAdmin } from '@/lib/email';
import type { TranslationLocale } from '@/lib/i18n/messages';
import { buildQuoteConversation } from '@/lib/quote-conversation';

export const runtime = 'nodejs';

interface RouteParams {
  params: Promise<{ token: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    await ConnectDb();

    const { token } = await params;
    const body = (await request.json()) as { message?: string; locale?: string };
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    const locale: TranslationLocale = body.locale === 'fr' ? 'fr' : 'en';

    if (!message) {
      return NextResponse.json({ success: false, error: 'Message is required' }, { status: 400 });
    }

    if (message.length > 2000) {
      return NextResponse.json({ success: false, error: 'Message cannot exceed 2000 characters' }, { status: 400 });
    }

    const quote = await Quote.findOne({ rejectedSignToken: token });
    if (!quote) {
      return NextResponse.json({ success: false, error: 'not_found' }, { status: 404 });
    }

    if (quote.status !== 'rejected') {
      // Quote was resent or otherwise moved — this link is no longer for replies
      return NextResponse.json({ success: false, error: 'link_no_longer_valid' }, { status: 410 });
    }

    const sentAt = new Date();

    // Append client message to the conversation thread
    const updatedQuote = await Quote.findByIdAndUpdate(
      quote._id,
      {
        $push: {
          conversationMessages: { role: 'client', text: message, sentAt },
        },
      },
      { returnDocument: 'after', strict: false }
    );

    if (!updatedQuote) {
      return NextResponse.json({ success: false, error: 'Quote could not be updated' }, { status: 404 });
    }

    await createActivityLog(String(quote.user), {
      action: 'quote_client_replied',
      entityType: 'quote',
      entityName: quote.quoteNumber,
      entityId: String(quote._id),
      metadata: {
        clientName: quote.clientSnapshot?.fullName ?? 'Client',
        messagePreview: message.slice(0, 120),
        source: 'client_reply',
      },
    });

    // Notify the admin — awaited so serverless doesn't cut it off before the email sends
    try {
      const adminUser = await User.findById(quote.user).select('email name').lean();
      const adminEmail = (adminUser as { email?: string } | null)?.email;

      if (adminEmail) {
        const adminName = (adminUser as { name?: string } | null)?.name ?? 'Admin';

        const companyProfile = await CompanyProfile.findOne({ user: quote.user })
          .select('companyName ownerName')
          .lean();
        const companyName =
          (companyProfile?.companyName as string | undefined) ||
          (companyProfile?.ownerName as string | undefined) ||
          'Your Company';

        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
        const quoteDetailUrl = appUrl ? `${appUrl}/quotes/${String(quote._id)}` : '';

        await sendClientReplyNotificationToAdmin({
          to: adminEmail,
          adminName,
          companyName,
          clientName: quote.clientSnapshot?.fullName ?? 'Client',
          quoteNumber: quote.quoteNumber,
          messageBody: message,
          quoteDetailUrl,
          locale,
        });
      }
    } catch {
      // email failure must not prevent the client from seeing their reply was saved
      console.error('Failed to notify admin of client reply');
    }

    return NextResponse.json({
      success: true,
      message: { role: 'client', text: message, sentAt: sentAt.toISOString() },
      conversationMessages: buildQuoteConversation(
        updatedQuote as unknown as {
          rejectionComment?: string | null;
          adminReplyMessage?: string | null;
          conversationMessages?: Array<{ role?: string | null; text?: string | null; sentAt?: Date | string | null }>;
        }
      ),
    });
  } catch (error) {
    console.error('Error sending client reply:', error);
    return NextResponse.json({ success: false, error: 'Failed to send reply' }, { status: 500 });
  }
}
