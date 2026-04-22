import { NextRequest, NextResponse } from 'next/server';

import ConnectDb from '@/db/connectDb';
import Invoice from '@/db/models/Invoice';
import { finalizeStripeInvoiceCheckoutSession } from '@/lib/payments/finalizeStripeInvoiceCheckoutSession';
import { stripe } from '@/lib/stripe';

export const runtime = 'nodejs';

interface RouteParams {
  params: Promise<{ token: string }>;
}

interface ConfirmBody {
  sessionId?: string;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { token } = await params;
    const body = (await request.json().catch(() => ({}))) as ConfirmBody;
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : '';

    if (!token || !sessionId) {
      return NextResponse.json({ success: false, message: 'Missing payment confirmation details' }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const sessionToken = session.metadata?.paymentToken?.trim();
    const sessionSource = session.metadata?.paymentSource?.trim();
    const invoiceId = session.metadata?.invoiceId?.trim();

    if (sessionSource !== 'invoice_token' || !invoiceId) {
      return NextResponse.json({ success: false, message: 'Payment session not found' }, { status: 404 });
    }

    await ConnectDb();

    const invoice = await Invoice.findById(invoiceId)
      .select('_id paymentToken paymentTokenExpiry status totalIncludingTax')
      .lean<{
        _id: string;
        paymentToken?: string | null;
        paymentTokenExpiry?: Date | null;
        status?: string;
        totalIncludingTax?: number;
      } | null>();

    if (!invoice) {
      return NextResponse.json({ success: false, message: 'Invoice not found' }, { status: 404 });
    }

    if (sessionToken && sessionToken !== token) {
      return NextResponse.json({ success: false, message: 'Payment session not found' }, { status: 404 });
    }

    if (!sessionToken && invoice.paymentToken && invoice.paymentToken !== token) {
      return NextResponse.json({ success: false, message: 'Payment session not found' }, { status: 404 });
    }

    const finalized = await finalizeStripeInvoiceCheckoutSession(session, { sendReceipt: true });
    if (finalized.kind === 'not-paid') {
      return NextResponse.json({ success: false, message: 'Payment has not been completed yet' }, { status: 409 });
    }

    if (finalized.kind !== 'ok') {
      return NextResponse.json({ success: false, message: 'Invoice not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        invoiceId: finalized.invoiceId,
        invoiceNumber: finalized.invoiceNumber,
        status: finalized.invoiceStatus,
        totalPaid: finalized.totalPaid,
        totalAmount: finalized.invoiceTotal,
        remainingAmount: finalized.remainingAmount,
        canPay: (finalized.remainingAmount ?? 0) > 0 && finalized.invoiceStatus !== 'paid',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to confirm payment';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}