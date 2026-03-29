import { NextRequest, NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import React from 'react';
import type { DocumentProps } from '@react-pdf/renderer';
import ConnectEmailClient from '@/emails/connectEmailClient';
import { getQuoteEmailTemplate } from '@/emails/quoteEmailTemplate';
import { getCompanyProfileByUserId } from '@/db/repository/cprofile';
import { getQuoteById, updateQuoteStatusById } from '@/db/repository/quote';
import { createActivityLog } from '@/db/repository/activity';
import { computeQuoteLine } from '@/lib/quote-calculations';
import { QuotePdfTemplate } from '@/lib/pdf/QuotePdfTemplate';
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

    if (!email || typeof email !== 'string' || !email.trim()) {
      return NextResponse.json({ success: false, message: 'Client email is required' }, { status: 400 });
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return NextResponse.json({ success: false, message: 'Invalid email address' }, { status: 400 });
    }

    const locale: 'en' | 'fr' = rawLocale === 'fr' ? 'fr' : 'en';
    const { id } = await params;

    const quote = await getQuoteById(me.user.id, id);
    if (!quote) {
      return NextResponse.json({ success: false, message: 'Quote not found' }, { status: 404 });
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
    } catch {
      if (!baseCompanyData?.logoUrl) {
        return NextResponse.json({ success: false, message: 'Failed to generate PDF' }, { status: 500 });
      }
      pdfBuffer = await renderToBuffer(createPdfDocument(''));
    }

 
    const emailTransporter = await ConnectEmailClient();
    if (!emailTransporter) {
      return NextResponse.json({ success: false, message: 'Failed to connect to email service' }, { status: 500 });
    }

    const emailSubject = subject?.trim() || (locale === 'fr'
      ? `Votre devis ${quote.quoteNumber}`
      : `Your quote ${quote.quoteNumber}`);

    const emailMessage = message?.trim() || (locale === 'fr'
      ? `Bonjour,\n\nVeuillez trouver ci-joint votre devis ${quote.quoteNumber}.\n\nN'hésitez pas à revenir vers nous pour toute question.\n\nBien cordialement,`
      : `Hello,\n\nPlease find attached your quote ${quote.quoteNumber}.\n\nFeel free to contact us if you have any questions.\n\nBest regards,`);

    const formatCurrency = (value: number) =>
      new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-US', {
        style: 'currency',
        currency: 'EUR',
      }).format(value);

    const formatDate = (d: Date | string) =>
      new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(new Date(d));

    const emailHtml = getQuoteEmailTemplate({
      messageBody: emailMessage,
      subject: emailSubject,
      company: baseCompanyData
        ? {
            companyName: baseCompanyData.companyName,
            ownerName: baseCompanyData.ownerName,
            address: baseCompanyData.address,
            phone: baseCompanyData.phone,
            email: baseCompanyData.businessEmail,
            vatNumber: baseCompanyData.vatNumber,
            logoUrl: baseCompanyData.logoUrl,
          }
        : null,
      client: {
        fullName: quote.clientSnapshot.fullName,
        companyName: quote.clientSnapshot.companyName ?? null,
        email: quote.clientSnapshot.email ?? null,
      },
      quote: {
        quoteNumber: quote.quoteNumber,
        date: formatDate(quote.date),
        totalIncludingTax: formatCurrency(derivedTotals.totalIncludingTax),
        validityDays: quote.validityDays ?? 30,
      },
      locale,
    });

    const senderName = baseCompanyData?.companyName || baseCompanyData?.ownerName || 'CRM';

    await emailTransporter.sendMail({
      from: `"${senderName}" <${process.env.EMAIL_USER_V2 || process.env.EMAIL_USER}>`,
      to: email.trim(),
      subject: emailSubject,
      html: emailHtml,
      text: emailMessage,
      attachments: [
        {
          filename: `${quote.quoteNumber}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });


    if (quote.status === 'draft') {
      const statusResult = await updateQuoteStatusById(me.user.id, id, { to: 'sent' });

      if (statusResult.kind === 'ok') {
        await createActivityLog(me.user.id, {
          action: 'quote_status_changed',
          entityType: 'quote',
          entityName: quote.quoteNumber,
          entityId: quote._id,
          metadata: { from: 'draft', to: 'sent' },
        });
      }
    }


    await createActivityLog(me.user.id, {
      action: 'quote_sent',
      entityType: 'quote',
      entityName: quote.quoteNumber,
      entityId: quote._id,
      metadata: { sentTo: email.trim() },
    });

    return NextResponse.json({ success: true, message: 'Quote sent successfully' });
  } catch (error) {
    console.error('Error sending quote:', error);
    return NextResponse.json(
      { success: false, message: `Error sending quote: ${String(error)}` },
      { status: 500 }
    );
  }
}
