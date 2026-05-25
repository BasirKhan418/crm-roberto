import { NextResponse, NextRequest } from "next/server";
import { signupSchema } from "@/validators/auth.schema";
import { buildValidationError } from "@/utils/api/validation";
import { createI18nKey as i18nKey } from "@/lib/i18n/messages";
export async function POST(request: NextRequest) {
    try {
        const { name, email, password } = await request.json() as {
            name: string;
            email: string;
            password: string;
        };
      
        const validation = signupSchema.safeParse({ name, email, password });

        if (!validation.success) {
            return NextResponse.json(buildValidationError(validation.error), { status: 400 });
        }

        return NextResponse.json(
            {
                success: false,
                message: i18nKey("auth.signupInvitationOnly"),
            },
            { status: 403 }
        );
    }
    catch (error) {
        console.error("POST /api/(auth)/signup failed", error);
        return NextResponse.json({ message: i18nKey("auth.registerError"), success: false }, { status: 500 });
    }
}