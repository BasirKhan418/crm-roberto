import { NextResponse, NextRequest } from "next/server";
import { signupSchema } from "@/validators/auth.schema";
import { buildValidationError } from "@/utils/api/validation";
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
                message: "Signup is invitation-only. Ask your administrator for an invitation.",
            },
            { status: 403 }
        );
    }
    catch (error) {
        return NextResponse.json({ message: "Error registering user" + error, success: false });
    }
}