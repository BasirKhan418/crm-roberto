import mongoose from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';

import ConnectDb from '@/db/connectDb';
import CompanyProfile from '@/db/models/CompanyProfile';
import Invoice from '@/db/models/Invoice';
import Payment from '@/db/models/Payment';
import ReminderSettings from '@/db/models/ReminderSettings';
import { formatInvoiceDisplayNumber } from '@/lib/i18n/messages';
import {
  resolveReminderLocalePreference,
  renderLegalNoticePdfForReminder,
  type CompanyProfileForReminder,
  type InvoiceForPdf,
} from '@/lib/reminders/formal-notice';
import getMe from '@/utils/middlewares/useMe';

interface RouteParams {
  params: Promise<{ id: string }>;
}

type InvoiceForLegalNotice = {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  invoiceNumber: string;
  quoteNumber?: string | null;
  date?: Date | null;
  dueDate?: Date | null;
  status?: 'unpaid' | 'partial_paid' | 'paid' | 'overdue';
  lineItems?: Array<{
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
  reminderState?: {
    level?: number | null;
    lateFeeAmount?: number | null;
    formalNoticeSentAt?: Date | null;
  } | null;
};

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const me = await getMe(true);
    if (!me.success || !me.user) {
      return NextResponse.json({ success: false, message: me.message || 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, message: 'Invoice not found' }, { status: 404 });
    }

    await ConnectDb();

    const invoice = await Invoice.findOne({ _id: id, userId: me.user.id })
      .select('_id userId invoiceNumber quoteNumber date dueDate status lineItems totalExcludingTax totalVat totalIncludingTax depositPercentage notes clientSnapshot reminderState')
      .lean<InvoiceForLegalNotice | null>();

    if (!invoice) {
      return NextResponse.json({ success: false, message: 'Invoice not found' }, { status: 404 });
    }

    const [settingsDoc, companyProfile, totals] = await Promise.all([
      ReminderSettings.findOne({ userId: me.user.id }).lean<{
        legalNotice?: { delayDays?: 8 | 15; includeInterestClause?: boolean; customFooter?: string | null };
      } | null>(),
      CompanyProfile.findOne({ user: me.user.id })
        .select('companyName ownerName locale address streetNumber streetName postalCode city country phone businessEmail vatNumber rcsNumber businessAuthorizationNumber matriculeNumber iban bankName legalIdentifier logoUrl')
        .lean<CompanyProfileForReminder | null>(),
      Payment.aggregate<{ _id: null; totalPaid: number }>([
        { $match: { invoiceId: invoice._id, userId: new mongoose.Types.ObjectId(me.user.id), status: 'succeeded' } },
        { $group: { _id: null, totalPaid: { $sum: '$amount' } } },
      ]),
    ]);

    const rawLocale = request.nextUrl.searchParams.get('locale');
    const locale = resolveReminderLocalePreference(rawLocale, me.user.locale, companyProfile?.locale);
    const totalPaid = Math.max(0, Math.round(totals[0]?.totalPaid ?? 0));
    const remainingAmount = Math.max(0, Math.round(invoice.totalIncludingTax ?? 0) - totalPaid);
    const lateFeeAmount = Math.max(0, Math.round(invoice.reminderState?.lateFeeAmount ?? 0));

    // Formal notice PDF is always available; the UI surfaces a warning when the invoice is not
    // yet overdue but the action is never blocked (parity with reminders 1–3).
    const legalNoticeSettings = settingsDoc?.legalNotice;
    const delayDays = legalNoticeSettings?.delayDays === 15 ? 15 : 8;
    const includeInterestClause = legalNoticeSettings?.includeInterestClause !== false;
    const customFooter = legalNoticeSettings?.customFooter ?? null;

    const legalNoticeDate = invoice.reminderState?.formalNoticeSentAt ?? new Date();

    const { pdfBuffer } = await renderLegalNoticePdfForReminder({
      invoice: {
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
      } satisfies InvoiceForPdf,
      companyProfile,
      locale,
      remainingAmountCents: remainingAmount,
      lateFeeAmountCents: lateFeeAmount,
      legalNoticeDate,
      delayDays,
      includeInterestClause,
      customFooter,
    });

    const displayInvoiceNumber = formatInvoiceDisplayNumber(locale, invoice.invoiceNumber);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${locale === 'fr' ? 'mise-en-demeure' : 'formal-notice'}-${displayInvoiceNumber}.pdf"`,
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: `Error generating legal notice PDF: ${String(error)}` }, { status: 500 });
  }
}
