import { NextRequest, NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import React from 'react';
import type { DocumentProps } from '@react-pdf/renderer';

import { getCompanyProfileByUserId } from '@/db/repository/cprofile';
import { getQuoteById } from '@/db/repository/quote';
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
      lineItems: quote.lineItems.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unitPriceExcludingTax: item.unitPriceExcludingTax,
        vatRate: item.vatRate,
        totalExcludingTax: item.totalExcludingTax,
      })),
      totalExcludingTax: quote.totalExcludingTax,
      totalVat: quote.totalVat,
      totalIncludingTax: quote.totalIncludingTax,
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
