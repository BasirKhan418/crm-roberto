import { NextRequest, NextResponse } from "next/server";

import { authorizeAccountantTicketAccess } from "@/app/api/accountant/_shared/tickets";
import { listTickets } from "@/db/repository/ticket";
import { buildValidationError } from "@/utils/api/validation";
import { ticketListQuerySchema } from "@/validators/ticket.schema";

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