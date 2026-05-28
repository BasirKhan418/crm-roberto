import { NextRequest, NextResponse } from "next/server";

import { authorizeAccountantTicketAccess } from "@/app/api/accountant/_shared/tickets";
import { addTicketMessage } from "@/db/repository/ticket";
import { buildAccountantTicketAttachmentFileUrl } from "@/lib/storage/private-file-urls";
import { getClientIp } from "@/utils/api/request";
import { buildValidationError } from "@/utils/api/validation";
import { ticketReplySchema } from "@/validators/ticket.schema";

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

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await authorizeAccountantTicketAccess();
    if (!auth.success) {
      return auth.response;
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = ticketReplySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(buildValidationError(parsed.error), { status: 400 });
    }

    const result = await addTicketMessage({
      companyId: auth.context.user.companyId || "",
      ticketId: id,
      authorId: auth.context.user.id,
      payload: parsed.data,
      access: auth.context.accessScope,
      ipAddress: getClientIp(request),
    });

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(
      {
        success: true,
        message: "Message added",
        data: {
          message: {
            ...result.message,
            attachments: mapTicketAttachmentUrls(result.message.attachments as Array<Record<string, unknown>> | undefined),
          },
          status: result.status,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, message: `Error posting accountant ticket reply: ${String(error)}` },
      { status: 500 }
    );
  }
}