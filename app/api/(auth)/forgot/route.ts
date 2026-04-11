import { NextResponse,NextRequest } from "next/server";
import jwt from "jsonwebtoken";
import { randomInt } from "crypto";
import { generateOtp } from "@/utils/otp/generateOtp";
import { verifyOtp } from "@/utils/otp/verifyotp";
import getUserByEmail from "@/db/repository/getUserByEmail";
import { SendForgotPasswordEmail } from "@/emails/auth/forgotEmail";
import { buildValidationError } from "@/utils/api/validation";
import { forgotPasswordSchema } from "@/validators/forgot.schema";
import { resolveLocaleFromRequest } from "@/lib/i18n/locale";
export async function POST(request: NextRequest) {
    try{
        const { email ,status,otp, locale: rawLocale } = await request.json() as {
            email: string;
            status: string;
            otp?: string;
            locale?: string;
        };
        const locale = resolveLocaleFromRequest(request, { rawLocale });
        const parseResult = forgotPasswordSchema.safeParse({ email, status, otp });
        if (!parseResult.success) {
            return NextResponse.json(buildValidationError(parseResult.error), { status: 400 });
        }
        if(status === "forgot"){
            const userResult = await getUserByEmail(email);
            if(!userResult.success){
                return NextResponse.json({ message: "If that email is registered, a reset code has been sent.", success: true },{ status: 200 });
            }
            const generatedOtp = randomInt(100000, 1000000).toString(); // cryptographically secure
            const ttl = 5 * 60; 
            const result = await generateOtp(`forgot:${email}`, generatedOtp, ttl);
            if (!result.success) {
                return NextResponse.json({ message: result.message, success: false },{ status: 429 });
            }

            const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
            const resetUrl = `${appBaseUrl}/forgot-password?email=${encodeURIComponent(email)}&otp=${encodeURIComponent(generatedOtp)}`;
            const emailSendResult = await SendForgotPasswordEmail({ email, otp: generatedOtp, locale, resetUrl });
            if (!emailSendResult.success) {
                return NextResponse.json({ message: "Failed to send reset email. Please try again.", success: false }, { status: 500 });
            }

            return NextResponse.json({ message: "If that email is registered, a reset code has been sent.", success: true },{ status: 200 });
        }
        //handle otp verification for forgot password
        if (typeof otp !== "string" || !otp.trim()) {
            return NextResponse.json({ message: "OTP is required", success: false },{ status: 400 });
        }
        const verifyResult = await verifyOtp(`forgot:${email}`, otp);
        if(verifyResult.success){
            const token = jwt.sign({ email }, process.env.JWT_SECRET ||"", { expiresIn: '15m' });
            return NextResponse.json({ message: "OTP verified successfully", success: true, token },{ status: 200 });
        }
        return NextResponse.json({ message: verifyResult.message, success: false },{ status: 400 });
        
    }
    catch(error){
        return NextResponse.json({ message: "Error occurred while processing forgot password request: "+error, success: false },{ status: 500 });
    }
}