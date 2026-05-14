import { NextRequest, NextResponse } from "next/server";

import { authorizeTicketRoute } from "@/app/api/tickets/_shared";
import { changeTicketStatus } from "@/db/repository/ticket";
import { getClientIp } from "@/utils/api/request";
import { buildValidationError } from "@/utils/api/validation";
import { ticketStatusChangeSchema } from "@/validators/ticket.schema";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await authorizeTicketRoute("manage");
    if (!auth.success) {
      return auth.response;
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = ticketStatusChangeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(buildValidationError(parsed.error), { status: 400 });
    }

    const result = await changeTicketStatus({
      companyId: auth.context.user.companyId || "",
      ticketId: id,
      updatedBy: auth.context.user.id,
      payload: parsed.data,
      access: auth.context.accessScope,
      ipAddress: getClientIp(request),
    });

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json({ success: true, ticket: result.ticket }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: `Error changing ticket status: ${String(error)}` },
      { status: 500 }
    );
  }
}
