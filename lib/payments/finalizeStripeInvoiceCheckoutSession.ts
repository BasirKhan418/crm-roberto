import type Stripe from 'stripe';

import ConnectDb from '@/db/connectDb';
import Invoice from '@/db/models/Invoice';
import Payment from '@/db/models/Payment';
import { createActivityLog } from '@/db/repository/activity';
import { sendPaymentReceiptForSucceededPayment } from '@/lib/payments/sendPaymentReceiptForSucceededPayment';

function isDuplicateKeyError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  return (error as { code?: number }).code === 11000;
}

export interface FinalizedStripeInvoiceCheckoutResult {
  kind: 'ok' | 'not-paid' | 'missing-invoice-id' | 'invoice-not-found';
  invoiceId?: string;
  invoiceNumber?: string;
  invoiceStatus?: 'unpaid' | 'partial_paid' | 'paid' | 'overdue';
  totalPaid?: number;
  invoiceTotal?: number;
  remainingAmount?: number;
}

export async function finalizeStripeInvoiceCheckoutSession(
  session: Stripe.Checkout.Session,
  options: { sendReceipt?: boolean } = {}
): Promise<FinalizedStripeInvoiceCheckoutResult> {
  await ConnectDb();

  if (session.payment_status !== 'paid') {
    return { kind: 'not-paid' };
  }

  const invoiceId = session.metadata?.invoiceId?.trim();
  const paymentType = session.metadata?.paymentType;

  if (!invoiceId) {
    return { kind: 'missing-invoice-id' };
  }

  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) {
    return { kind: 'invoice-not-found' };
  }

  const stripePaymentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id;

  let paymentInserted = false;
  let paymentId: string | null = null;
  let paymentRecord: {
    amount: number;
    type: 'deposit' | 'full' | 'remaining_balance';
    method: string;
  } | null = null;

  if (stripePaymentId) {
    try {
      const created = await Payment.create({
        userId: invoice.userId,
        invoiceId: invoice._id,
        stripePaymentId,
        amount: session.amount_total ?? 0,
        currency: session.currency ?? 'eur',
        type:
          paymentType === 'deposit'
            ? 'deposit'
            : paymentType === 'remaining_balance'
              ? 'remaining_balance'
              : 'full',
        status: 'succeeded',
        method: session.payment_method_types?.[0] ?? 'card',
        source: 'stripe',
        paidAt: new Date(),
      });
      paymentInserted = true;
      paymentId = String(created._id);
      paymentRecord = {
        amount: created.amount,
        type: created.type,
        method: created.method,
      };
    } catch (error) {
      if (!isDuplicateKeyError(error)) {
        throw error;
      }

      const existingPayment = await Payment.findOne({ stripePaymentId })
        .select('_id')
        .lean<{ _id: { toString(): string } } | null>();
      paymentId = existingPayment ? String(existingPayment._id) : null;
    }
  }

  const totals = await Payment.aggregate<{ _id: null; paidTotal: number }>([
    {
      $match: {
        userId: invoice.userId,
        invoiceId: invoice._id,
        status: 'succeeded',
      },
    },
    { $group: { _id: null, paidTotal: { $sum: '$amount' } } },
  ]);

  const totalPaid = Math.max(0, Math.round(totals[0]?.paidTotal ?? 0));
  const invoiceTotal = Math.max(0, Math.round(invoice.totalIncludingTax ?? 0));
  const remainingAmount = Math.max(0, invoiceTotal - totalPaid);

  if (totalPaid >= invoiceTotal) {
    invoice.status = 'paid';
    invoice.paymentToken = null;
    invoice.paymentTokenExpiry = null;
  } else if (totalPaid > 0) {
    invoice.status = 'partial_paid';
  } else {
    invoice.status = 'unpaid';
  }

  await invoice.save();

  if (paymentInserted && paymentRecord) {
    await createActivityLog(String(invoice.userId), {
      action: 'invoice_payment_received',
      entityType: 'invoice',
      entityName: invoice.invoiceNumber,
      entityId: String(invoice._id),
      metadata: {
        source: 'stripe',
        amount: paymentRecord.amount,
        paymentType: paymentRecord.type,
        method: paymentRecord.method,
        invoiceStatus: invoice.status,
        totalPaid,
        invoiceTotal,
        remainingAmount,
      },
    });
  }

  if (options.sendReceipt === true && paymentId) {
    await sendPaymentReceiptForSucceededPayment({ paymentId });
  }

  return {
    kind: 'ok',
    invoiceId: String(invoice._id),
    invoiceNumber: invoice.invoiceNumber,
    invoiceStatus: invoice.status,
    totalPaid,
    invoiceTotal,
    remainingAmount,
  };
}