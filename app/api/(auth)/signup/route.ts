import { NextResponse, NextRequest } from "next/server";
import argon2 from "argon2";
import { signupSchema } from "@/validators/auth.schema";
import { registerUser } from "@/db/repository/auth";
import { generateOtp } from "@/utils/otp/generateOtp";
import { sendOtpEmail } from "@/emails/auth/verifyEmail";
import { buildValidationError } from "@/utils/api/validation";
import { randomInt } from "crypto";
import { resolveLocaleFromRequest } from "@/lib/i18n/locale";
export async function POST(request: NextRequest) {
    try {
        const pepper = process.env.PASSWORD_PEPPER;
        const { name, email, password, locale: rawLocale } = await request.json() as {
            name: string;
            email: string;
            password: string;
            locale?: string;
        };
        const locale = resolveLocaleFromRequest(request, { rawLocale });
      
        const validation = signupSchema.safeParse({ name, email, password });

        if (!validation.success) {
            return NextResponse.json(buildValidationError(validation.error), { status: 400 });
        }
        const hashedPassword = await argon2.hash(password + pepper);
        const result = await registerUser(name, email, hashedPassword);
        if (result.success) {
          
            const otp = randomInt(100000, 1000000).toString(); 
            const otpResult = await generateOtp(email, otp, 300); 
            if (!otpResult.success) {
                return NextResponse.json({ message: otpResult.message, success: false }, { status: 429 });
            }
            sendOtpEmail({ email, otp, locale });
        }
        return NextResponse.json(result, { status: result.success ? 200 : 400 });
    }
    catch (error) {
        return NextResponse.json({ message: "Error registering user" + error, success: false });
    }
}