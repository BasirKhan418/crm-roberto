import { NextRequest, NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import React from 'react';
import type { DocumentProps } from '@react-pdf/renderer';

import QuoteSignature from '@/db/models/QuoteSignature';
import { getCompanyProfileByUserId } from '@/db/repository/cprofile';
import { getQuoteById } from '@/db/repository/quote';
import { computeQuoteLine } from '@/lib/quote-calculations';
import { QuotePdfTemplate } from '@/lib/pdf/QuotePdfTemplate';
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
    const locale: 'en' | 'fr' = rawLocale === 'fr' ? 'fr' : 'en';

    const { id } = await params;
    const quote = await getQuoteById(me.user.id, id);
    if (!quote) {
      return NextResponse.json({ success: false, message: 'Quote not found' }, { status: 404 });
    }

    const companyResult = await getCompanyProfileByUserId(me.user.id);
    const company = companyResult.success ? (companyResult.profile as Record<string, unknown>) : null;

    const latestSignature = quote.signedStatus === 'signed'
      ? await QuoteSignature.findOne({ quoteId: quote._id, userId: me.user.id, isUsed: true })
          .sort({ signedAt: -1, createdAt: -1 })
          .select({ signatureDataUrl: 1, signedAt: 1 })
          .lean()
      : null;

    // CRITICAL: Always recompute from base data to guarantee consistency.
    // Never trust stored totals — they may be stale or calculated incorrectly.
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
      signedStatus: quote.signedStatus ?? 'not_signed',
      signedAt: quote.signedAt ?? (latestSignature?.signedAt as Date | undefined) ?? null,
      signatureDataUrl: (latestSignature?.signatureDataUrl as string | undefined) ?? null,
      notes: quote.notes ?? null,
      paymentTerms: quote.paymentTerms ?? null,
      validityDays: quote.validityDays ?? 30,
    };

    const baseCompanyData = company
      ? {
          companyName: (company.companyName as string) || '',
          ownerName: (company.ownerName as string) || '',
          address: (company.address as string) || '',
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
    } catch (error) {
      // Some remote logo URLs can fail fetch/decoding in Node PDF rendering.
      // Retry once without the logo so download still works.
      if (!baseCompanyData?.logoUrl) {
        throw error;
      }
      pdfBuffer = await renderToBuffer(createPdfDocument(''));
    }

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${quote.quoteNumber}.pdf"`,
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: `Error generating quote PDF: ${String(error)}` }, { status: 500 });
  }
}
