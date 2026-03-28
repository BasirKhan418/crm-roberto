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

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const me = await getMe(true);
    if (!me.success || !me.user) {
      return NextResponse.json({ success: false, message: me.message || 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const quote = await getQuoteById(me.user.id, id);
    if (!quote) {
      return NextResponse.json({ success: false, message: 'Quote not found' }, { status: 404 });
    }

    const companyResult = await getCompanyProfileByUserId(me.user.id);
    const company = companyResult.success ? (companyResult.profile as Record<string, unknown>) : null;

    const pdfDocument = React.createElement(QuotePdfTemplate, {
        quote: {
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
        },
        company: company
          ? {
              companyName: (company.companyName as string) || '',
              ownerName: (company.ownerName as string) || '',
              address: (company.address as string) || '',
              phone: (company.phone as string) || '',
              businessEmail: (company.businessEmail as string) || '',
              vatNumber: (company.vatNumber as string) || '',
              logoUrl: (company.logoUrl as string | null) ?? null,
            }
          : null,
      }) as unknown as React.ReactElement<DocumentProps>;

    const pdfBuffer = await renderToBuffer(pdfDocument);

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
