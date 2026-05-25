import { NextRequest, NextResponse } from "next/server";

import { authorizeAccountantTicketAccess } from "@/app/api/accountant/_shared/tickets";
import { getTicketThread, markTicketRead } from "@/db/repository/ticket";

interface RouteParams {
  params: Promise<{ id: string }>;
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

    return NextResponse.json({ success: true, ticket: threadResult.ticket }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: `Error fetching accountant ticket detail: ${String(error)}` },
      { status: 500 }
    );
  }
}