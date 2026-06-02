import { NextRequest, NextResponse } from "next/server";

import { authorizeTicketRoute } from "@/app/api/tickets/_shared";
import { createTicket, listTickets } from "@/db/repository/ticket";
import { buildTicketAttachmentFileUrl } from "@/lib/storage/private-file-urls";
import { getClientIp } from "@/utils/api/request";
import { buildValidationError } from "@/utils/api/validation";
import { createTicketSchema, ticketListQuerySchema } from "@/validators/ticket.schema";

function mapTicketAttachmentUrls<T extends { _id?: unknown; url?: unknown }>(attachments: T[] | undefined) {
  if (!Array.isArray(attachments)) {
    return attachments;
  }

  return attachments.map((attachment) => {
    const attachmentId =
      typeof attachment._id === "string"
        ? attachment._id
        : attachment._id && typeof attachment._id === "object" && typeof (attachment._id as { toString?: unknown }).toString === "function"
          ? String(attachment._id)
          : "";

    return attachmentId
      ? {
          ...attachment,
          url: buildTicketAttachmentFileUrl(attachmentId),
        }
      : attachment;
  });
}

export async function GET(request: NextRequest) {
  try {
    const auth = await authorizeTicketRoute("view");
    if (!auth.success) {
      return auth.response;
    }

    const queryPayload = {
      status: request.nextUrl.searchParams.get("status") || undefined,
      statusBucket: request.nextUrl.searchParams.get("statusBucket") || undefined,
      type: request.nextUrl.searchParams.get("type") || undefined,
      linkedType: request.nextUrl.searchParams.get("linkedType") || undefined,
      linkedId: request.nextUrl.searchParams.get("linkedId") || undefined,
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

    return NextResponse.json(
      {
        success: true,
        items: result.items,
        pagination: result.pagination,
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, message: `Error fetching tickets: ${String(error)}` },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authorizeTicketRoute("manage");
    if (!auth.success) {
      return auth.response;
    }

    const body = await request.json();
    const parsed = createTicketSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(buildValidationError(parsed.error), { status: 400 });
    }

    const created = await createTicket({
      companyId: auth.context.user.companyId || "",
      createdBy: auth.context.user.id,
      payload: parsed.data,
      ipAddress: getClientIp(request),
    });

    if (!created.success) {
      return NextResponse.json(created, { status: 400 });
    }

    return NextResponse.json(
      {
        success: true,
        message: "Ticket created successfully",
        ticket: created.ticket,
        initialMessage: created.initialMessage
          ? {
              ...created.initialMessage,
              attachments: mapTicketAttachmentUrls(created.initialMessage.attachments as Array<Record<string, unknown>> | undefined),
            }
          : created.initialMessage,
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, message: `Error creating ticket: ${String(error)}` },
      { status: 500 }
    );
  }
}
