import { NextRequest, NextResponse } from "next/server";

import { authorizeTicketRoute } from "@/app/api/tickets/_shared";
import { markTicketRead } from "@/db/repository/ticket";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await authorizeTicketRoute("view");
    if (!auth.success) {
      return auth.response;
    }

    const { id } = await params;

    const result = await markTicketRead({
      companyId: auth.context.user.companyId || "",
      ticketId: id,
      userId: auth.context.user.id,
      access: auth.context.accessScope,
    });

    if (!result.success) {
      return NextResponse.json(result, { status: 404 });
    }

    return NextResponse.json({ success: true, ticket: result.ticket }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: `Error marking ticket as read: ${String(error)}` },
      { status: 500 }
    );
  }
}
