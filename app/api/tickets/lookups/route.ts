import { NextRequest, NextResponse } from "next/server";

import { authorizeTicketRoute } from "@/app/api/tickets/_shared";
import { listTicketRecipients } from "@/db/repository/ticket";
import { buildValidationError } from "@/utils/api/validation";
import { ticketLookupQuerySchema } from "@/validators/ticket.schema";

export async function GET(request: NextRequest) {
  try {
    const auth = await authorizeTicketRoute("view");
    if (!auth.success) {
      return auth.response;
    }

    const parsed = ticketLookupQuerySchema.safeParse({
      search: request.nextUrl.searchParams.get("search") || undefined,
      limit: request.nextUrl.searchParams.get("limit") || undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(buildValidationError(parsed.error), { status: 400 });
    }

    const result = await listTicketRecipients({
      companyId: auth.context.user.companyId || "",
      search: parsed.data.search,
      limit: parsed.data.limit || 30,
    });

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json({ success: true, users: result.users }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: `Error loading ticket lookups: ${String(error)}` },
      { status: 500 }
    );
  }
}
