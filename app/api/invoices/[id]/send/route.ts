import type { DocumentProps } from '@react-pdf/renderer';
import { renderToBuffer } from '@react-pdf/renderer';
import { NextRequest, NextResponse } from 'next/server';
import React from 'react';

import ConnectDb from '@/db/connectDb';
import Client from '@/db/models/Client';
import Invoice from '@/db/models/Invoice';
import Payment from '@/db/models/Payment';
import StripeConnect from '@/db/models/StripeConnect';
import { getCompanyProfileByUserId } from '@/db/repository/cprofile';
import { extractClientSnapshot } from '@/lib/address';
import { sendInvoice } from '@/lib/email';
import { resolveLocaleFromValue } from '@/lib/i18n/locale';
import { InvoicePdfTemplate } from '@/lib/pdf/InvoicePdfTemplate';
import { buildInvoicePayUrl, generatePaymentToken, generateTokenExpiry, isTokenExpired } from '@/lib/tokens';
import getMe from '@/utils/middlewares/useMe';

export const runtime = 'nodejs';

interface RouteParams {
  params: Promise<{ id: string }>;
}

type InvoiceSendMode = 'normal' | 'online';

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const me = await getMe(true);
    if (!me.success || !me.user) {
      return NextResponse.json({ success: false, message: me.message || 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { email, subject, message, locale: rawLocale, sendMode: rawSendMode } = body as {
      email?: string;
      subject?: string;
      message?: string;
      locale?: string;
      sendMode?: string;
    };
    const locale = resolveLocaleFromValue(rawLocale, resolveLocaleFromValue(me.user.locale, 'fr'));
    const sendMode: InvoiceSendMode = rawSendMode === 'online' ? 'online' : 'normal';
    const customSubject = typeof subject === 'string' && subject.trim() ? subject.trim() : undefined;
    const customMessageBody = typeof message === 'string' && message.trim() ? message.trim() : undefined;

    const { id } = await params;

    await ConnectDb();

    if (sendMode === 'online') {
      const stripeConnect = await StripeConnect.findOne({ userId: me.user.id })
        .select('onboardingComplete chargesEnabled payoutsEnabled')
        .lean<{ onboardingComplete?: boolean; chargesEnabled?: boolean; payoutsEnabled?: boolean } | null>();

      if (!stripeConnect?.onboardingComplete || !stripeConnect?.chargesEnabled) {
        return NextResponse.json(
          { success: false, message: 'Please connect Stripe before sending invoice with online payment.' },
          { status: 422 }
        );
      }
    }

    const invoice = await Invoice.findOne({ _id: id, userId: me.user.id })
      .select(
        '_id userId clientId invoiceNumber quoteNumber date dueDate status lineItems totalExcludingTax totalVat totalIncludingTax depositPercentage notes paymentToken paymentTokenExpiry clientSnapshot'
      )
      .lean();

    if (!invoice) {
      return NextResponse.json({ success: false, message: 'Invoice not found' }, { status: 404 });
    }

    if (invoice.status === 'paid') {
      return NextResponse.json({ success: false, message: 'Cannot send a paid invoice' }, { status: 403 });
    }

    const clientDoc = await Client.findOne({ _id: invoice.clientId, user: me.user.id })
      .select('billingEmail')
      .lean<{ billingEmail?: string | null } | null>();

    const billingEmail = clientDoc?.billingEmail?.trim() ?? '';
    const snapshotEmail = invoice.clientSnapshot?.email?.trim() ?? '';
    const providedEmail = typeof email === 'string' && email.trim() ? email.trim() : '';

    let recipientEmail = billingEmail || snapshotEmail;

    if (providedEmail) {
      const providedLower = providedEmail.toLowerCase();
      const snapshotLower = snapshotEmail.toLowerCase();
      const billingLower = billingEmail.toLowerCase();

      const isLegacyDefaultSnapshot = Boolean(billingEmail) && providedLower === snapshotLower && providedLower !== billingLower;
      recipientEmail = isLegacyDefaultSnapshot ? billingEmail : providedEmail;
    }

    if (!recipientEmail) {
      return NextResponse.json({ success: false, message: 'Client email is required' }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
      return NextResponse.json({ success: false, message: 'Invalid email address' }, { status: 400 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    let paymentUrl: string | null = null;

    if (sendMode === 'online') {
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

      paymentUrl = buildInvoicePayUrl(paymentToken, appUrl);
    }

    const companyResult = await getCompanyProfileByUserId(me.user.id);
    const profile = companyResult.success
      ? (companyResult.profile as {
          companyName?: string | null;
          ownerName?: string | null;
          address?: string | null;
          streetNumber?: string | null;
          streetName?: string | null;
          postalCode?: string | null;
          city?: string | null;
          country?: string | null;
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

    const baseCompanyData = profile
      ? {
          companyName: profile.companyName ?? profile.ownerName ?? 'CRM',
          ownerName: profile.ownerName ?? null,
          address: profile.address ?? null,
          streetNumber: profile.streetNumber ?? null,
          streetName: profile.streetName ?? null,
          postalCode: profile.postalCode ?? null,
          city: profile.city ?? null,
          country: profile.country ?? null,
          phone: profile.phone ?? null,
          businessEmail: profile.businessEmail ?? null,
          vatNumber: profile.vatNumber ?? null,
          logoUrl: profile.logoUrl ?? null,
        }
      : null;

    const createPdfDocument = (logoUrlOverride?: string | null) =>
      React.createElement(InvoicePdfTemplate, {
        invoice: {
          status: invoice.status,
          invoiceNumber: invoice.invoiceNumber,
          quoteNumber: invoice.quoteNumber ?? null,
          date: invoice.date,
          dueDate: invoice.dueDate ?? null,
          clientSnapshot: extractClientSnapshot(invoice.clientSnapshot),
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
        company: baseCompanyData
          ? {
              ...baseCompanyData,
              logoUrl: logoUrlOverride ?? baseCompanyData.logoUrl,
            }
          : null,
        paymentUrl,
        locale,
      }) as unknown as React.ReactElement<DocumentProps>;

    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await renderToBuffer(createPdfDocument());
    } catch {
      if (!baseCompanyData?.logoUrl) {
        return NextResponse.json({ success: false, message: 'Failed to generate PDF' }, { status: 500 });
      }
      pdfBuffer = await renderToBuffer(createPdfDocument(''));
    }

    await sendInvoice({
      to: recipientEmail,
      clientName: invoice.clientSnapshot?.fullName ?? 'Client',
      invoiceNumber: invoice.invoiceNumber,
      paymentUrl,
      amount,
      companyName,
      pdfBuffer,
      locale,
      includeOnlinePayment: sendMode === 'online',
      subject: customSubject,
      messageBody: customMessageBody,
    });

    return NextResponse.json({ success: true, message: 'Invoice sent successfully' });
  } catch (error) {
    return NextResponse.json({ success: false, message: `Error sending invoice: ${String(error)}` }, { status: 500 });
  }
}
