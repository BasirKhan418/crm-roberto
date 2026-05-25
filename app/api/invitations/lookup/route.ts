import { NextRequest, NextResponse } from "next/server";

import { getInvitationByToken } from "@/db/repository/company";
import { createI18nKey as i18nKey } from "@/lib/i18n/messages";
import { buildValidationError } from "@/utils/api/validation";
import { invitationLookupSchema } from "@/validators/invitation.schema";

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token");
    const validation = invitationLookupSchema.safeParse({ token });

    if (!validation.success) {
      return NextResponse.json(buildValidationError(validation.error), { status: 400 });
    }

    const result = await getInvitationByToken(validation.data.token);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    console.error("GET /api/invitations/lookup failed", error);
    return NextResponse.json(
      { success: false, message: i18nKey("users.lookupInvitationError") },
      { status: 500 }
    );
  }
}
