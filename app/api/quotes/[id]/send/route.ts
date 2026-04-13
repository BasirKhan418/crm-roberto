import { NextRequest, NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import React from 'react';
import type { DocumentProps } from '@react-pdf/renderer';
import Quote from '@/db/models/Quote';
import { getCompanyProfileByUserId } from '@/db/repository/cprofile';
import { getQuoteById, updateQuoteStatusById } from '@/db/repository/quote';
import { createActivityLog } from '@/db/repository/activity';
import { sendQuoteEmail } from '@/lib/email';
import { computeQuoteLine } from '@/lib/quote-calculations';
import { QuotePdfTemplate } from '@/lib/pdf/QuotePdfTemplate';
import { buildSignUrl, generateSignToken, generateTokenExpiry } from '@/lib/tokens';
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
    const { id } = await params;

    const quote = await getQuoteById(me.user.id, id);
    if (!quote) {
      return NextResponse.json({ success: false, message: 'Quote not found' }, { status: 404 });
    }

    if (!['draft', 'sent', 'rejected'].includes(quote.status) || quote.signedStatus === 'signed') {
      return NextResponse.json(
        { success: false, message: 'Cannot send a signed quote from its current status' },
        { status: 403 }
      );
    }

    const recipientEmail = typeof email === 'string' && email.trim()
      ? email.trim()
      : quote.clientSnapshot.email?.trim() ?? '';

    if (!recipientEmail) {
      return NextResponse.json({ success: false, message: 'Client email is required' }, { status: 400 });
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
      return NextResponse.json({ success: false, message: 'Invalid email address' }, { status: 400 });
    }

    const companyResult = await getCompanyProfileByUserId(me.user.id);
    const company = companyResult.success ? (companyResult.profile as Record<string, unknown>) : null;

 // gen pdf
    const computedLines = quote.lineItems.map((item) =>
      computeQuoteLine({
        quantity: item.quantity,
        unitPriceExcludingTax: item.unitPriceExcludingTax,
        baseUnitPriceExcludingTax: item.baseUnitPriceExcludingTax,
        discountPercentage: item.discountPercentage,
        vatRate: item.vatRate,
      })
    );

    const lineItems = quote.lineItems.map((item, idx) => {
      const computed = computedLines[idx];
      return {
        name: item.name,
        quantity: computed.quantity,
        baseUnitPriceExcludingTax: computed.baseUnitPriceExcludingTax,
        unitPriceExcludingTax: computed.unitPriceExcludingTax,
        discountPercentage: computed.discountPercentage,
        vatRate: computed.vatRate,
        totalExcludingTaxBeforeDiscount: computed.totalExcludingTaxBeforeDiscount,
        discountAmountExcludingTax: computed.discountAmountExcludingTax,
        totalExcludingTax: computed.totalExcludingTax,
        vatAmount: computed.vatAmount,
        totalIncludingTax: computed.totalIncludingTax,
      };
    });

    const derivedTotals = computedLines.reduce(
      (acc, item) => {
        acc.totalExcludingTaxBeforeDiscount += item.totalExcludingTaxBeforeDiscount;
        acc.totalDiscountExcludingTax += item.discountAmountExcludingTax;
        acc.totalExcludingTax += item.totalExcludingTax;
        acc.totalVat += item.vatAmount;
        acc.totalIncludingTax += item.totalIncludingTax;
        return acc;
      },
      {
        totalExcludingTaxBeforeDiscount: 0,
        totalDiscountExcludingTax: 0,
        totalExcludingTax: 0,
        totalVat: 0,
        totalIncludingTax: 0,
      }
    );

    const quoteData = {
      quoteNumber: quote.quoteNumber,
      date: quote.date,
      status: quote.status,
      clientSnapshot: {
        fullName: quote.clientSnapshot.fullName,
        companyName: quote.clientSnapshot.companyName ?? null,
        address: quote.clientSnapshot.address ?? null,
        addressDetails: (quote.clientSnapshot as { addressDetails?: { streetNumber?: string | null; streetName?: string | null; postalCode?: string | null; city?: string | null; country?: string | null } | null }).addressDetails ?? null,
        email: quote.clientSnapshot.email ?? null,
        phone: quote.clientSnapshot.phone ?? null,
        vatNumber: quote.clientSnapshot.vatNumber ?? null,
      },
      lineItems,
      totalExcludingTaxBeforeDiscount: derivedTotals.totalExcludingTaxBeforeDiscount,
      totalDiscountExcludingTax: derivedTotals.totalDiscountExcludingTax,
      totalExcludingTax: derivedTotals.totalExcludingTax,
      totalVat: derivedTotals.totalVat,
      totalIncludingTax: derivedTotals.totalIncludingTax,
      notes: quote.notes ?? null,
      paymentTerms: quote.paymentTerms ?? null,
      validityDays: quote.validityDays ?? 30,
    };

    const baseCompanyData = company
      ? {
          companyName: (company.companyName as string) || '',
          ownerName: (company.ownerName as string) || '',
          address: (company.address as string | null) ?? null,
          streetNumber: (company.streetNumber as string | null) ?? null,
          streetName: (company.streetName as string | null) ?? null,
          postalCode: (company.postalCode as string | null) ?? null,
          city: (company.city as string | null) ?? null,
          country: (company.country as string | null) ?? null,
          phone: (company.phone as string) || '',
          businessEmail: (company.businessEmail as string) || '',
          vatNumber: (company.vatNumber as string) || '',
          logoUrl: (company.logoUrl as string | null) ?? null,
        }
      : null;

    const createPdfDocument = (logoUrlOverride?: string | null) =>
      React.createElement(QuotePdfTemplate, {
        quote: quoteData,
        company: baseCompanyData
          ? {
              ...baseCompanyData,
              logoUrl: logoUrlOverride ?? baseCompanyData.logoUrl,
            }
          : null,
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

    const signatureToken = generateSignToken();
    const signatureTokenExpiry = generateTokenExpiry(30);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    const signUrl = buildSignUrl(signatureToken, baseUrl);

    const tokenUpdateResult = await Quote.updateOne(
      { _id: id, user: me.user.id },
      {
        $set: {
          signatureToken,
          signatureTokenExpiry,
          signedStatus: 'not_signed',
          signedAt: null,
          adminReplyMessage: null,
          // Always persist the actual recipient email so reply routes use the right address
          'clientSnapshot.email': recipientEmail,
          // rejectedSignToken intentionally kept: old rejection link returns
          // 'link_no_longer_valid' (410) instead of 'not_found' (404)
        },
      }
    );

    if (tokenUpdateResult.matchedCount === 0) {
      return NextResponse.json({ success: false, message: 'Quote not found' }, { status: 404 });
    }

    await sendQuoteEmail({
      to: recipientEmail,
      clientName: quote.clientSnapshot.fullName,
      quoteNumber: quote.quoteNumber,
      quoteDate: quote.date,
      totalIncludingTax: derivedTotals.totalIncludingTax,
      validityDays: quote.validityDays ?? 30,
      signUrl,
      subject,
      messageBody: message,
      locale,
      companyName: baseCompanyData?.companyName || baseCompanyData?.ownerName || 'CRM',
      company: {
        companyName: baseCompanyData?.companyName,
        ownerName: baseCompanyData?.ownerName,
        address: baseCompanyData?.address ?? undefined,
        phone: baseCompanyData?.phone,
        email: baseCompanyData?.businessEmail,
        vatNumber: baseCompanyData?.vatNumber,
        logoUrl: baseCompanyData?.logoUrl,
      },
      clientCompanyName: quote.clientSnapshot.companyName ?? null,
      pdfBuffer,
    });


    if (quote.status === 'draft' || quote.status === 'rejected') {
      const statusFrom = quote.status;
      const statusResult = await updateQuoteStatusById(me.user.id, id, { to: 'sent' });

      if (statusResult.kind === 'ok') {
        await createActivityLog(me.user.id, {
          action: 'quote_status_changed',
          entityType: 'quote',
          entityName: quote.quoteNumber,
          entityId: quote._id,
          metadata: { from: statusFrom, to: 'sent' },
        });
      }
    }


    await createActivityLog(me.user.id, {
      action: 'quote_sent',
      entityType: 'quote',
      entityName: quote.quoteNumber,
      entityId: quote._id,
      metadata: {
        sentTo: recipientEmail,
        quoteEmailSent: true,
        signLinkGenerated: true,
        signatureTokenExpiry: signatureTokenExpiry.toISOString(),
      },
    });

    return NextResponse.json({ success: true, message: 'Quote sent for signing', signUrl });
  } catch (error) {
    console.error('Error sending quote:', error);
    return NextResponse.json(
      { success: false, message: `Error sending quote: ${String(error)}` },
      { status: 500 }
    );
  }
}
