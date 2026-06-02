import { NextRequest, NextResponse } from "next/server";

import { authorizeTicketRoute } from "@/app/api/tickets/_shared";
import { getTicketThread } from "@/db/repository/ticket";
import { buildTicketAttachmentFileUrl } from "@/lib/storage/private-file-urls";

interface RouteParams {
  params: Promise<{ id: string }>;
}

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

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await authorizeTicketRoute("view");
    if (!auth.success) {
      return auth.response;
    }

    const { id } = await params;

    const result = await getTicketThread({
      companyId: auth.context.user.companyId || "",
      ticketId: id,
      access: auth.context.accessScope,
    });

    if (!result.success) {
      return NextResponse.json(result, { status: 404 });
    }

    return NextResponse.json(
      {
        success: true,
        ticket: {
          ...result.ticket,
          attachments: mapTicketAttachmentUrls(result.ticket.attachments as Array<Record<string, unknown>> | undefined),
          messages: Array.isArray(result.ticket.messages)
            ? result.ticket.messages.map((message) => ({
                ...message,
                attachments: mapTicketAttachmentUrls(message.attachments as Array<Record<string, unknown>> | undefined),
              }))
            : result.ticket.messages,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, message: `Error fetching ticket detail: ${String(error)}` },
      { status: 500 }
    );
  }
}
