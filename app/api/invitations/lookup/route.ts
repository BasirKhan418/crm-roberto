import { NextRequest, NextResponse } from "next/server";

import { getInvitationByToken } from "@/db/repository/company";
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
    return NextResponse.json(
      { success: false, message: `Error checking invitation ${error}` },
      { status: 500 }
    );
  }
}
