import mongoose from 'mongoose';

import ConnectDb from '@/db/connectDb';
import Client from '@/db/models/Client';
import CompanyProfile from '@/db/models/CompanyProfile';
import { resolveCompanyMemberUserIds, resolveCompanyOwnerUserId } from '@/db/repository/company-owner';
import Invoice from '@/db/models/Invoice';
import Payment from '@/db/models/Payment';
import User from '@/db/models/User';
import { sendPaymentReceipt } from '@/lib/email';
import {
  formatEurFromCents,
  renderInvoicePdfForReminder,
  resolveCompanyDisplayName,
  resolveReminderLocalePreference,
  type CompanyProfileForReminder,
  type InvoiceForPdf,
  type PaymentHistoryItem,
} from '@/lib/reminders/formal-notice';

type PaymentReceiptSendReason = 'missing-payment' | 'already-sent' | 'missing-invoice' | 'missing-email';

interface PaymentReceiptSendResult {
  sent: boolean;
  reason?: PaymentReceiptSendReason;
}

type SucceededPaymentRecord = {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  invoiceId: mongoose.Types.ObjectId;
  amount: number;
  method: string;
  type: 'deposit' | 'full' | 'remaining_balance';
  status: 'succeeded';
  paidAt?: Date | null;
  createdAt?: Date | null;
  receiptSentAt?: Date | null;
  receiptDispatchingAt?: Date | null;
};

type InvoiceForPaymentReceipt = {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  clientId: mongoose.Types.ObjectId;
  invoiceNumber: string;
  quoteNumber?: string | null;
  date?: Date | null;
  dueDate?: Date | null;
  status?: 'unpaid' | 'partial_paid' | 'paid' | 'overdue';
  lineItems: Array<{
    name: string;
    quantity: number;
    baseUnitPriceExcludingTax: number;
    discountPercentage: number;
    discountAmountExcludingTax: number;
    vatRate: number;
    totalExcludingTax: number;
  }>;
  totalExcludingTax?: number | null;
  totalVat?: number | null;
  totalIncludingTax?: number | null;
  depositPercentage?: number | null;
  notes?: string | null;
  clientSnapshot?: {
    fullName?: string | null;
    companyName?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    addressDetails?: {
      streetNumber?: string | null;
      streetName?: string | null;
      postalCode?: string | null;
      city?: string | null;
      country?: string | null;
    } | null;
  } | null;
};

function toInvoicePdfInput(invoice: InvoiceForPaymentReceipt): InvoiceForPdf {
  return {
    _id: invoice._id,
    invoiceNumber: invoice.invoiceNumber,
    quoteNumber: invoice.quoteNumber ?? null,
    date: invoice.date ?? null,
    dueDate: invoice.dueDate ?? null,
    status: invoice.status,
    lineItems: invoice.lineItems ?? [],
    totalExcludingTax: Math.max(0, Math.round(invoice.totalExcludingTax ?? 0)),
    totalVat: Math.max(0, Math.round(invoice.totalVat ?? 0)),
    totalIncludingTax: Math.max(0, Math.round(invoice.totalIncludingTax ?? 0)),
    depositPercentage: invoice.depositPercentage ?? 100,
    notes: invoice.notes ?? null,
    clientSnapshot: {
      fullName: invoice.clientSnapshot?.fullName || 'Client',
      companyName: invoice.clientSnapshot?.companyName ?? null,
      email: invoice.clientSnapshot?.email ?? null,
      phone: invoice.clientSnapshot?.phone ?? null,
      address: invoice.clientSnapshot?.address ?? null,
      addressDetails: invoice.clientSnapshot?.addressDetails ?? null,
    },
  };
}

function resolveRecipientEmail(billingEmail?: string | null, snapshotEmail?: string | null): string {
  const normalizedBillingEmail = billingEmail?.trim() ?? '';
  if (normalizedBillingEmail) {
    return normalizedBillingEmail;
  }

  return snapshotEmail?.trim() ?? '';
}

export async function sendPaymentReceiptForSucceededPayment({
  paymentId,
}: {
  paymentId: string;
}): Promise<PaymentReceiptSendResult> {
  await ConnectDb();

  const dispatchClaimedAt = new Date();
  const staleDispatchThreshold = new Date(dispatchClaimedAt.getTime() - 5 * 60 * 1000);

  const payment = await Payment.findOneAndUpdate(
    {
      _id: paymentId,
      status: 'succeeded',
      receiptSentAt: null,
      $or: [{ receiptDispatchingAt: null }, { receiptDispatchingAt: { $lt: staleDispatchThreshold } }],
    },
    {
      $set: { receiptDispatchingAt: dispatchClaimedAt },
    },
    { returnDocument: 'after' }
  )
    .select('_id userId invoiceId amount method type status paidAt createdAt receiptSentAt receiptDispatchingAt')
    .lean<SucceededPaymentRecord | null>();

  if (!payment) {
    const existingPayment = await Payment.findById(paymentId)
      .select('_id receiptSentAt receiptDispatchingAt status')
      .lean<{ _id: mongoose.Types.ObjectId; receiptSentAt?: Date | null; receiptDispatchingAt?: Date | null; status?: string } | null>();

    if (!existingPayment || existingPayment.status !== 'succeeded') {
      return { sent: false, reason: 'missing-payment' };
    }

    return { sent: false, reason: 'already-sent' };
  }

  const claimedPayment = payment;

  async function releaseDispatchLock() {
    await Payment.updateOne(
      { _id: claimedPayment._id, receiptDispatchingAt: dispatchClaimedAt, receiptSentAt: null },
      { $set: { receiptDispatchingAt: null } }
    );
  }

  try {
    const invoice = await Invoice.findOne({ _id: claimedPayment.invoiceId, userId: claimedPayment.userId })
      .select(
        '_id userId clientId invoiceNumber quoteNumber date dueDate status lineItems totalExcludingTax totalVat totalIncludingTax depositPercentage notes clientSnapshot'
      )
      .lean<InvoiceForPaymentReceipt | null>();

    if (!invoice) {
      await releaseDispatchLock();
      return { sent: false, reason: 'missing-invoice' };
    }

    const [clientDoc, companyProfile, user, payments] = await Promise.all([
      Client.findOne({ _id: invoice.clientId, user: { $in: await resolveCompanyMemberUserIds({ userId: claimedPayment.userId }) } })
        .select('billingEmail')
        .lean<{ billingEmail?: string | null } | null>(),
      CompanyProfile.findOne({ user: await resolveCompanyOwnerUserId({ userId: claimedPayment.userId }) })
        .select('companyName ownerName locale address streetNumber streetName postalCode city country phone businessEmail vatNumber rcsNumber businessAuthorizationNumber matriculeNumber iban bankName legalIdentifier logoUrl')
        .lean<CompanyProfileForReminder | null>(),
      User.findById(claimedPayment.userId).select('locale').lean<{ locale?: string | null } | null>(),
      Payment.find({ invoiceId: invoice._id, userId: claimedPayment.userId, status: 'succeeded' })
        .sort({ paidAt: -1, createdAt: -1 })
        .select('amount method type paidAt createdAt')
        .lean<Array<{ amount: number; method: string; type: 'deposit' | 'full' | 'remaining_balance'; paidAt?: Date | null; createdAt?: Date | null }>>(),
    ]);

    const recipientEmail = resolveRecipientEmail(clientDoc?.billingEmail, invoice.clientSnapshot?.email);
    if (!recipientEmail) {
      await releaseDispatchLock();
      return { sent: false, reason: 'missing-email' };
    }

    const locale = resolveReminderLocalePreference(user?.locale, companyProfile?.locale);
    const paymentHistory: PaymentHistoryItem[] = payments.map((item) => ({
      amount: item.amount,
      method: item.method,
      type: item.type,
      paidAt: item.paidAt ?? null,
      createdAt: item.createdAt ?? null,
    }));

    const invoiceTotal = Math.max(0, Math.round(invoice.totalIncludingTax ?? 0));
    const totalPaid = paymentHistory.reduce((sum, item) => sum + Math.max(0, Math.round(item.amount ?? 0)), 0);
    const remainingAmount = Math.max(0, invoiceTotal - totalPaid);

    const pdfBuffer = await renderInvoicePdfForReminder({
      invoice: toInvoicePdfInput(invoice),
      companyProfile,
      locale,
      lateFeeAmountCents: 0,
      payments: paymentHistory,
    });

    await sendPaymentReceipt({
      to: recipientEmail,
      clientName: invoice.clientSnapshot?.fullName || 'Client',
      invoiceNumber: invoice.invoiceNumber,
      amount: formatEurFromCents(claimedPayment.amount, locale),
      paymentMethod: claimedPayment.method,
      paymentType: claimedPayment.type,
      paidAt: claimedPayment.paidAt ?? claimedPayment.createdAt ?? new Date(),
      companyName: resolveCompanyDisplayName(companyProfile),
      pdfBuffer,
      locale,
      invoiceTotal: formatEurFromCents(invoiceTotal, locale),
      totalPaid: formatEurFromCents(totalPaid, locale),
      remainingAmount: formatEurFromCents(remainingAmount, locale),
      isFullyPaid: remainingAmount === 0,
    });

    await Payment.updateOne(
      { _id: claimedPayment._id, receiptDispatchingAt: dispatchClaimedAt, receiptSentAt: null },
      {
        $set: { receiptSentAt: new Date(), receiptDispatchingAt: null },
      }
    );

    return { sent: true };
  } catch (error) {
    await releaseDispatchLock();
    throw error;
  }
}