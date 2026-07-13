import { NextResponse } from "next/server";

import getAccountantSession from "@/utils/middlewares/accountantSession";

export async function authorizeAccountantTicketAccess() {
  const session = await getAccountantSession();

  if (!session.success || !session.user) {
    return {
      success: false as const,
      response: NextResponse.json(
        { success: false, message: session.message || "Unauthorized" },
        { status: 401 }
      ),
    };
  }

  return {
    success: true as const,
    context: {
      user: session.user,
      accessScope: {
        ownOrAssignedOnly: true,
        userId: session.user.id,
      },
    },
  };
}