import { NextRequest, NextResponse } from "next/server";

import { authorizeAccountantTicketAccess } from "@/app/api/accountant/_shared/tickets";
import { getTicketThread, markTicketRead } from "@/db/repository/ticket";
import { buildAccountantTicketAttachmentFileUrl } from "@/lib/storage/private-file-urls";

interface RouteParams {
  params: Promise<{ id: string }>;
}

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

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await authorizeAccountantTicketAccess();
    if (!auth.success) {
      return auth.response;
    }

    const { id } = await params;

    const [threadResult] = await Promise.all([
      getTicketThread({
        companyId: auth.context.user.companyId || "",
        ticketId: id,
        access: auth.context.accessScope,
      }),
      markTicketRead({
        companyId: auth.context.user.companyId || "",
        ticketId: id,
        userId: auth.context.user.id,
        access: auth.context.accessScope,
      }),
    ]);

    if (!threadResult.success) {
      return NextResponse.json(threadResult, { status: 404 });
    }

    return NextResponse.json(
      {
        success: true,
        ticket: {
          ...threadResult.ticket,
          attachments: mapTicketAttachmentUrls(threadResult.ticket.attachments as Array<Record<string, unknown>> | undefined),
          messages: Array.isArray(threadResult.ticket.messages)
            ? threadResult.ticket.messages.map((message) => ({
                ...message,
                attachments: mapTicketAttachmentUrls(message.attachments as Array<Record<string, unknown>> | undefined),
              }))
            : threadResult.ticket.messages,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, message: `Error fetching accountant ticket detail: ${String(error)}` },
      { status: 500 }
    );
  }
}