import type { DocumentProps } from '@react-pdf/renderer';
import { renderToBuffer } from '@react-pdf/renderer';
import { NextRequest, NextResponse } from 'next/server';
import React from 'react';

import ConnectDb from '@/db/connectDb';
import Invoice from '@/db/models/Invoice';
import Payment from '@/db/models/Payment';
import { getCompanyProfileByUserId } from '@/db/repository/cprofile';
import { formatInvoiceDisplayNumber } from '@/lib/i18n/messages';
import { resolveLocaleFromRequest } from '@/lib/i18n/locale';
import { InvoicePdfTemplate } from '@/lib/pdf/InvoicePdfTemplate';
import { buildInvoicePayUrl, isTokenExpired } from '@/lib/tokens';
import getMe from '@/utils/middlewares/useMe';

export const runtime = 'nodejs';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const me = await getMe(true);
    if (!me.success || !me.user) {
      return NextResponse.json({ success: false, message: me.message || 'Unauthorized' }, { status: 401 });
    }

    const rawLocale = request.nextUrl.searchParams.get('locale');
    const locale = resolveLocaleFromRequest(request, { rawLocale });

    const { id } = await params;

    await ConnectDb();

    const invoice = await Invoice.findOne({ _id: id, userId: me.user.id })
      .select(
        '_id invoiceNumber quoteNumber date dueDate status lineItems totalExcludingTax totalVat totalIncludingTax depositPercentage notes paymentToken paymentTokenExpiry clientSnapshot'
      )
      .lean();

    if (!invoice) {
      return NextResponse.json({ success: false, message: 'Invoice not found' }, { status: 404 });
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
          rcsNumber?: string | null;
          businessAuthorizationNumber?: string | null;
          matriculeNumber?: string | null;
          iban?: string | null;
          bankName?: string | null;
          legalIdentifier?: string | null;
          logoUrl?: string | null;
        })
      : null;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    const paymentUrl =
      typeof invoice.paymentToken === 'string' && invoice.paymentToken && !isTokenExpired(invoice.paymentTokenExpiry ?? null)
        ? buildInvoicePayUrl(invoice.paymentToken, appUrl)
        : null;

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
        status: invoice.status,
        invoiceNumber: invoice.invoiceNumber,
        quoteNumber: invoice.quoteNumber ?? null,
        date: invoice.date,
        dueDate: invoice.dueDate ?? null,
        clientSnapshot: {
          fullName: invoice.clientSnapshot?.fullName ?? 'Client',
          companyName: invoice.clientSnapshot?.companyName ?? null,
          address: invoice.clientSnapshot?.address ?? null,
          addressDetails: (invoice.clientSnapshot as { addressDetails?: { streetNumber?: string | null; streetName?: string | null; postalCode?: string | null; city?: string | null; country?: string | null } | null })?.addressDetails ?? null,
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
            streetNumber: profile.streetNumber ?? null,
            streetName: profile.streetName ?? null,
            postalCode: profile.postalCode ?? null,
            city: profile.city ?? null,
            country: profile.country ?? null,
            phone: profile.phone ?? null,
            businessEmail: profile.businessEmail ?? null,
            vatNumber: profile.vatNumber ?? null,
            rcsNumber: profile.rcsNumber ?? null,
            businessAuthorizationNumber: profile.businessAuthorizationNumber ?? null,
            matriculeNumber: profile.matriculeNumber ?? null,
            iban: profile.iban ?? null,
            bankName: profile.bankName ?? null,
            legalIdentifier: profile.legalIdentifier ?? null,
            logoUrl: profile.logoUrl ?? null,
          }
        : null,
      paymentUrl,
      locale,
    }) as unknown as React.ReactElement<DocumentProps>;

    const pdfBuffer = await renderToBuffer(invoicePdf);
    const attachmentFilename = `${formatInvoiceDisplayNumber(locale, invoice.invoiceNumber)}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${attachmentFilename}"`,
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: `Error generating invoice PDF: ${String(error)}` }, { status: 500 });
  }
}
