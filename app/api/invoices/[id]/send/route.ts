import type { DocumentProps } from '@react-pdf/renderer';
import { renderToBuffer } from '@react-pdf/renderer';
import { NextRequest, NextResponse } from 'next/server';
import React from 'react';

import ConnectDb from '@/db/connectDb';
import Invoice from '@/db/models/Invoice';
import Payment from '@/db/models/Payment';
import StripeConnect from '@/db/models/StripeConnect';
import { getCompanyProfileByUserId } from '@/db/repository/cprofile';
import { sendInvoice } from '@/lib/email';
import { InvoicePdfTemplate } from '@/lib/pdf/InvoicePdfTemplate';
import { buildInvoicePayUrl, generatePaymentToken, generateTokenExpiry, isTokenExpired } from '@/lib/tokens';
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

    const body = await request.json();
    const { email, subject, message, locale: rawLocale } = body as {
      email?: string;
      subject?: string;
      message?: string;
      locale?: string;
    };
    const locale: 'en' | 'fr' = rawLocale === 'fr' ? 'fr' : 'en';
    const customSubject = typeof subject === 'string' && subject.trim() ? subject.trim() : undefined;
    const customMessageBody = typeof message === 'string' && message.trim() ? message.trim() : undefined;

    const { id } = await params;

    await ConnectDb();

    const stripeConnect = await StripeConnect.findOne({ userId: me.user.id })
      .select('onboardingComplete chargesEnabled payoutsEnabled')
      .lean<{ onboardingComplete?: boolean; chargesEnabled?: boolean; payoutsEnabled?: boolean } | null>();

    if (!stripeConnect?.onboardingComplete || !stripeConnect?.chargesEnabled) {
      return NextResponse.json(
        { success: false, message: 'Please connect Stripe before sending invoice.' },
        { status: 422 }
      );
    }

    const invoice = await Invoice.findOne({ _id: id, userId: me.user.id })
      .select(
        '_id userId invoiceNumber quoteNumber date dueDate status lineItems totalExcludingTax totalVat totalIncludingTax depositPercentage notes paymentToken paymentTokenExpiry clientSnapshot'
      )
      .lean();

    if (!invoice) {
      return NextResponse.json({ success: false, message: 'Invoice not found' }, { status: 404 });
    }

    if (invoice.status === 'paid') {
      return NextResponse.json({ success: false, message: 'Cannot send a paid invoice' }, { status: 403 });
    }

    const recipientEmail =
      typeof email === 'string' && email.trim()
        ? email.trim()
        : invoice.clientSnapshot?.email?.trim() ?? '';

    if (!recipientEmail) {
      return NextResponse.json({ success: false, message: 'Client email is required' }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
      return NextResponse.json({ success: false, message: 'Invalid email address' }, { status: 400 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    let paymentToken = typeof invoice.paymentToken === 'string' && invoice.paymentToken.trim() ? invoice.paymentToken : null;
    let paymentTokenExpiry = invoice.paymentTokenExpiry ?? null;

    if (!paymentToken || isTokenExpired(paymentTokenExpiry)) {
      paymentToken = generatePaymentToken();
      paymentTokenExpiry = generateTokenExpiry(30);
      await Invoice.updateOne(
        { _id: invoice._id, userId: me.user.id },
        { $set: { paymentToken, paymentTokenExpiry } }
      );
    }

    const paymentUrl = buildInvoicePayUrl(paymentToken, appUrl);

    const companyResult = await getCompanyProfileByUserId(me.user.id);
    const profile = companyResult.success
      ? (companyResult.profile as {
          companyName?: string | null;
          ownerName?: string | null;
          address?: string | null;
          phone?: string | null;
          businessEmail?: string | null;
          vatNumber?: string | null;
          logoUrl?: string | null;
        })
      : null;

    const companyName = profile?.companyName || profile?.ownerName || 'CRM';

    const amount = new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', {
      style: 'currency',
      currency: 'EUR',
    }).format(invoice.totalIncludingTax / 100);

    const computedLineItems = invoice.lineItems.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      baseUnitPriceExcludingTax: item.baseUnitPriceExcludingTax,
      discountPercentage: item.discountPercentage,
      discountAmountExcludingTax: item.discountAmountExcludingTax,
      vatRate: item.vatRate,
      totalExcludingTax: item.totalExcludingTax,
    }));
    const depositPercentage = typeof invoice.depositPercentage === 'number' ? invoice.depositPercentage : 100;

    const totalExcludingTaxBeforeDiscount = computedLineItems.reduce(
      (sum, item) => sum + item.baseUnitPriceExcludingTax * item.quantity,
      0
    );
    const totalDiscountExcludingTax = computedLineItems.reduce(
      (sum, item) => sum + item.discountAmountExcludingTax,
      0
    );

    const payments = await Payment.find({
      invoiceId: invoice._id,
      userId: me.user.id,
      status: 'succeeded',
    })
      .sort({ paidAt: -1, createdAt: -1 })
      .select('amount method type paidAt createdAt')
      .lean();

    const invoicePdf = React.createElement(InvoicePdfTemplate, {
      invoice: {
        invoiceNumber: invoice.invoiceNumber,
        quoteNumber: invoice.quoteNumber ?? null,
        date: invoice.date,
        dueDate: invoice.dueDate ?? null,
        clientSnapshot: {
          fullName: invoice.clientSnapshot?.fullName ?? 'Client',
          companyName: invoice.clientSnapshot?.companyName ?? null,
          address: invoice.clientSnapshot?.address ?? null,
          email: invoice.clientSnapshot?.email ?? null,
          phone: invoice.clientSnapshot?.phone ?? null,
          vatNumber: invoice.clientSnapshot?.vatNumber ?? null,
        },
        lineItems: computedLineItems,
        totalExcludingTaxBeforeDiscount,
        totalDiscountExcludingTax,
        totalExcludingTax: invoice.totalExcludingTax,
        totalVat: invoice.totalVat,
        totalIncludingTax: invoice.totalIncludingTax,
        depositPercentage,
        notes: invoice.notes ?? null,
        payments: payments.map((payment) => ({
          amount: payment.amount,
          method: payment.method,
          type: payment.type,
          paidAt: payment.paidAt ?? null,
          createdAt: payment.createdAt ?? null,
        })),
      },
      company: profile
        ? {
            companyName: profile.companyName ?? profile.ownerName ?? 'CRM',
            ownerName: profile.ownerName ?? null,
            address: profile.address ?? null,
            phone: profile.phone ?? null,
            businessEmail: profile.businessEmail ?? null,
            vatNumber: profile.vatNumber ?? null,
            logoUrl: profile.logoUrl ?? null,
          }
        : null,
      paymentUrl,
      locale,
    }) as unknown as React.ReactElement<DocumentProps>;

    const pdfBuffer = await renderToBuffer(invoicePdf);

    await sendInvoice({
      to: recipientEmail,
      clientName: invoice.clientSnapshot?.fullName ?? 'Client',
      invoiceNumber: invoice.invoiceNumber,
      paymentUrl,
      amount,
      companyName,
      pdfBuffer,
      locale,
      subject: customSubject,
      messageBody: customMessageBody,
    });

    return NextResponse.json({ success: true, message: 'Invoice sent successfully' });
  } catch (error) {
    return NextResponse.json({ success: false, message: `Error sending invoice: ${String(error)}` }, { status: 500 });
  }
}
