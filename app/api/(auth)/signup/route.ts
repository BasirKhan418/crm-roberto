import { NextResponse, NextRequest } from "next/server";
import argon2 from "argon2";
import { signupSchema } from "@/validators/auth.schema";
import { registerUser } from "@/db/repository/auth";
import { generateOtp } from "@/utils/otp/generateOtp";
import { sendOtpEmail } from "@/emails/auth/verifyEmail";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
export async function POST(request: NextRequest) {
    try {
        const pepper = process.env.PASSWORD_PEPPER;
        const cookieStore = await cookies();
        const { name, email, password } = await request.json();
        //validate input
        const validation = signupSchema.safeParse({ name, email, password });

        if (!validation.success) {
            return NextResponse.json({ message: validation.error.issues[0].message, success: false });
        }
        //hash password
        const hashedPassword = await argon2.hash(password + pepper);
        //saved user to db
        const result = await registerUser(name, email, hashedPassword);
        if (result.success) {
            //generate token and set cookie 
            const token = jwt.sign({ sub: result.user._id, name: result.user.name, email: result.user.email }, process.env.JWT_SECRET || "", { expiresIn: '7d' });
            cookieStore.set("token", token, { httpOnly: true, secure: true, sameSite: "strict", maxAge: 7 * 24 * 60 * 60 });
            
            //trigger otp generation and sending email here
            const otp = Math.floor(100000 + Math.random() * 900000).toString(); // Generate a 6-digit OTP
            const otpResult = await generateOtp(email, otp, 300); // Store OTP with 5 minutes TTL
            if (!otpResult.success) {
                return NextResponse.json({ message: otpResult.message, success: false }, { status: 500 });
            }
            sendOtpEmail({ email, otp });

        }
        return NextResponse.json(result, { status: result.success ? 200 : 400 });
    }
    catch (error) {
        return NextResponse.json({ message: "Error registering user" + error, success: false });
    }
}