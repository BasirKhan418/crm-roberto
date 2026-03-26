import { NextResponse, NextRequest } from "next/server";
import argon2 from "argon2";
import { signupSchema } from "@/validators/auth.schema";
import { registerUser } from "@/db/repository/auth";
import { generateOtp } from "@/utils/otp/generateOtp";
import { sendOtpEmail } from "@/emails/auth/verifyEmail";
import { randomInt } from "crypto";
export async function POST(request: NextRequest) {
    try {
        const pepper = process.env.PASSWORD_PEPPER;
        const { name, email, password } = await request.json();
      
        const validation = signupSchema.safeParse({ name, email, password });

        if (!validation.success) {
            return NextResponse.json({ message: validation.error.issues[0].message, success: false });
        }
        const hashedPassword = await argon2.hash(password + pepper);
        const result = await registerUser(name, email, hashedPassword);
        if (result.success) {
          
            const otp = randomInt(100000, 1000000).toString(); 
            const otpResult = await generateOtp(email, otp, 300); 
            if (!otpResult.success) {
                return NextResponse.json({ message: otpResult.message, success: false }, { status: 429 });
            }
            sendOtpEmail({ email, otp });
        }
        return NextResponse.json(result, { status: result.success ? 200 : 400 });
    }
    catch (error) {
        return NextResponse.json({ message: "Error registering user" + error, success: false });
    }
}