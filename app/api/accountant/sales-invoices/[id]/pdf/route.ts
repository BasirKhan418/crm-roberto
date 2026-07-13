import type { DocumentProps } from "@react-pdf/renderer";
import { renderToBuffer } from "@react-pdf/renderer";
import { NextRequest, NextResponse } from "next/server";
import React from "react";

import { getAccountantSalesInvoicePdfData } from "@/db/repository/accountant-portal";
import { extractClientSnapshot } from "@/lib/address";
import { formatInvoiceDisplayNumber } from "@/lib/i18n/messages";
import { resolveLocaleFromValue } from "@/lib/i18n/locale";
import { InvoicePdfTemplate } from "@/lib/pdf/InvoicePdfTemplate";
import type { InvoiceForPdf, PaymentHistoryItem } from "@/lib/reminders/formal-notice";
import { buildInvoicePayUrl, isTokenExpired } from "@/lib/tokens";
import getAccountantSession from "@/utils/middlewares/accountantSession";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getAccountantSession();
    if (!session.success || !session.user) {
      return NextResponse.json({ success: false, message: session.message || "Unauthorized" }, { status: 401 });
    }

    const rawLocale = request.nextUrl.searchParams.get("locale");
    const locale = resolveLocaleFromValue(rawLocale, resolveLocaleFromValue(session.user.locale, "fr"));
    const { id } = await params;

    const result = await getAccountantSalesInvoicePdfData({
      companyId: session.user.companyId,
      invoiceId: id,
    });

    if (!result.success) {
      return NextResponse.json(result, { status: result.status });
    }

    const { invoice, payments, profile } = result.data;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    const paymentUrl =
      typeof invoice.paymentToken === "string" && invoice.paymentToken && !isTokenExpired(invoice.paymentTokenExpiry ?? null)
        ? buildInvoicePayUrl(invoice.paymentToken, appUrl)
        : null;

    const totalExcludingTaxBeforeDiscount = invoice.lineItems.reduce(
      (sum, item) => sum + item.baseUnitPriceExcludingTax * item.quantity,
      0
    );
    const totalDiscountExcludingTax = invoice.lineItems.reduce(
      (sum, item) => sum + item.discountAmountExcludingTax,
      0
    );
    const depositPercentage = typeof invoice.depositPercentage === "number" ? invoice.depositPercentage : 100;
    const computedLineItems: InvoiceForPdf["lineItems"] = invoice.lineItems.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      baseUnitPriceExcludingTax: item.baseUnitPriceExcludingTax,
      discountPercentage: item.discountPercentage,
      discountAmountExcludingTax: item.discountAmountExcludingTax,
      vatRate: item.vatRate,
      totalExcludingTax: item.totalExcludingTax,
      lineType:
        item.lineType === "catalog" ||
        item.lineType === "custom" ||
        item.lineType === "free_text" ||
        item.lineType === "item"
          ? item.lineType
          : null,
    }));
    const normalizedStatus =
      invoice.status === "unpaid" ||
      invoice.status === "partial_paid" ||
      invoice.status === "paid" ||
      invoice.status === "overdue"
        ? invoice.status
        : "unpaid";
    const normalizedPayments: PaymentHistoryItem[] = payments.map((payment) => ({
      amount: payment.amount,
      method: payment.method || "manual",
      type:
        payment.type === "deposit" || payment.type === "remaining_balance"
          ? payment.type
          : "full",
      paidAt: payment.paidAt ?? null,
      createdAt: payment.createdAt ?? null,
    }));

    const invoicePdf = React.createElement(InvoicePdfTemplate, {
      invoice: {
        status: normalizedStatus,
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
        payments: normalizedPayments,
      },
      company: profile
        ? {
            companyName: profile.companyName ?? profile.ownerName ?? "CRM",
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
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${attachmentFilename}"`,
      },
    });
  } catch (error) {
    console.error("GET /api/accountant/sales-invoices/[id]/pdf failed", error);
    return NextResponse.json(
      { success: false, message: `Error generating invoice PDF: ${String(error)}` },
      { status: 500 }
    );
  }
}