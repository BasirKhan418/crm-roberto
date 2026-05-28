import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { authorizeAccountantTicketAccess } from "@/app/api/accountant/_shared/tickets";
import {
  createAccountantPurchaseTicket,
  createAccountantSalesTicket,
} from "@/db/repository/accountant-portal";
import { listTickets } from "@/db/repository/ticket";
import { buildAccountantTicketAttachmentFileUrl } from "@/lib/storage/private-file-urls";
import { getClientIp } from "@/utils/api/request";
import { buildValidationError } from "@/utils/api/validation";
import { ticketListQuerySchema } from "@/validators/ticket.schema";
import { ACCOUNTANT_PURCHASE_TICKET_REASONS } from "@/lib/tickets/accountant-purchase-ticket";
import { ACCOUNTANT_SALES_TICKET_REASONS } from "@/lib/tickets/accountant-sales-ticket";

function mapTicketAttachmentUrls<T extends { _id?: unknown; url?: unknown }>(attachments: T[] | undefined) {
  if (!Array.isArray(attachments)) {
    return attachments;
  }

  return attachments.map((attachment) => {
    const attachmentId = typeof attachment._id === "string" ? attachment._id : "";

    return attachmentId
      ? {
          ...attachment,
          url: buildAccountantTicketAttachmentFileUrl(attachmentId),
        }
      : attachment;
  });
}

const purchaseTicketSchema = z.object({
  expenseId: z.string().trim().regex(/^[0-9a-fA-F]{24}$/, "Invalid expense id"),
  reason: z.enum(ACCOUNTANT_PURCHASE_TICKET_REASONS),
  note: z.string().trim().max(2500).optional().nullable(),
  locale: z.enum(["en", "fr"]).optional().default("en"),
});

const salesTicketSchema = z.object({
  invoiceId: z.string().trim().regex(/^[0-9a-fA-F]{24}$/, "Invalid invoice id"),
  reason: z.enum(ACCOUNTANT_SALES_TICKET_REASONS),
  note: z.string().trim().max(2500).optional().nullable(),
  locale: z.enum(["en", "fr"]).optional().default("en"),
});

export async function GET(request: NextRequest) {
  try {
    const auth = await authorizeAccountantTicketAccess();
    if (!auth.success) {
      return auth.response;
    }

    const queryPayload = {
      status: request.nextUrl.searchParams.get("status") || undefined,
      assignedToMe: request.nextUrl.searchParams.get("assignedToMe") || undefined,
      createdByMe: request.nextUrl.searchParams.get("createdByMe") || undefined,
      unreadOnly: request.nextUrl.searchParams.get("unreadOnly") || undefined,
      search: request.nextUrl.searchParams.get("search") || undefined,
      sortBy: request.nextUrl.searchParams.get("sortBy") || undefined,
      sortOrder: request.nextUrl.searchParams.get("sortOrder") || undefined,
      page: request.nextUrl.searchParams.get("page") || undefined,
      limit: request.nextUrl.searchParams.get("limit") || undefined,
    };

    const parsedFilters = ticketListQuerySchema.safeParse(queryPayload);
    if (!parsedFilters.success) {
      return NextResponse.json(buildValidationError(parsedFilters.error), { status: 400 });
    }

    const result = await listTickets({
      companyId: auth.context.user.companyId || "",
      options: {
        page: parsedFilters.data.page || 1,
        limit: parsedFilters.data.limit || 20,
        search: parsedFilters.data.search || "",
        sortBy: parsedFilters.data.sortBy || "updatedAt",
        sortOrder: parsedFilters.data.sortOrder || "desc",
      },
      filters: parsedFilters.data,
      access: auth.context.accessScope,
    });

    return NextResponse.json({ success: true, items: result.items, pagination: result.pagination }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: `Error fetching accountant tickets: ${String(error)}` },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authorizeAccountantTicketAccess();
    if (!auth.success) {
      return auth.response;
    }

    const body = await request.json();

    if (typeof body?.invoiceId === "string") {
      const parsed = salesTicketSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(buildValidationError(parsed.error), { status: 400 });
      }

      const result = await createAccountantSalesTicket({
        companyId: auth.context.user.companyId || "",
        accountantUserId: auth.context.user.id,
        invoiceId: parsed.data.invoiceId,
        reason: parsed.data.reason,
        note: parsed.data.note,
        locale: parsed.data.locale,
        ipAddress: getClientIp(request),
      });

      if (!result.success) {
        return NextResponse.json({ success: false, message: result.message }, { status: result.status });
      }

      return NextResponse.json(
        {
          success: true,
          message: "Invoice ticket created successfully",
          ticket: result.data.ticket,
          initialMessage: result.data.initialMessage
            ? {
                ...result.data.initialMessage,
                attachments: mapTicketAttachmentUrls(result.data.initialMessage.attachments as Array<Record<string, unknown>> | undefined),
              }
            : result.data.initialMessage,
          data: {
            ticketId: result.data.ticketId,
            recipientIds: result.data.recipientIds,
          },
        },
        { status: 201 }
      );
    }

    const parsed = purchaseTicketSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(buildValidationError(parsed.error), { status: 400 });
    }

    const result = await createAccountantPurchaseTicket({
      companyId: auth.context.user.companyId || "",
      accountantUserId: auth.context.user.id,
      expenseId: parsed.data.expenseId,
      reason: parsed.data.reason,
      note: parsed.data.note,
      locale: parsed.data.locale,
      ipAddress: getClientIp(request),
    });

    if (!result.success) {
      return NextResponse.json({ success: false, message: result.message }, { status: result.status });
    }

    return NextResponse.json(
      {
        success: true,
        message: "Purchase ticket created successfully",
        ticket: result.data.ticket,
        initialMessage: result.data.initialMessage
          ? {
              ...result.data.initialMessage,
              attachments: mapTicketAttachmentUrls(result.data.initialMessage.attachments as Array<Record<string, unknown>> | undefined),
            }
          : result.data.initialMessage,
        data: {
          ticketId: result.data.ticketId,
          recipientIds: result.data.recipientIds,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, message: `Error creating accountant ticket: ${String(error)}` },
      { status: 500 }
    );
  }
}