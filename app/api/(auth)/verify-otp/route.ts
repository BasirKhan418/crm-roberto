import { NextResponse,NextRequest } from "next/server";
import { verifyOtp } from "@/utils/otp/verifyotp";
import { markEmailAsVerified } from "@/db/repository/auth";
import getUserByEmail from "@/db/repository/getUserByEmail";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { z } from "zod";

const verifyOtpSchema = z.object({
    email: z.string().email("Invalid email"),
    otp: z.string().length(6, "OTP must be 6 digits").regex(/^\d+$/, "OTP must be numeric"),
});

export async function POST(request: NextRequest) {
    try{
        const body = await request.json();
        const parsed = verifyOtpSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ message: parsed.error.issues[0].message, success: false }, { status: 400 });
        }
        const { email, otp } = parsed.data;

        const result = await verifyOtp(email, otp);
        if(result.success){
            await markEmailAsVerified(email);

            const userResult = await getUserByEmail(email);
            if (userResult.success && userResult.user) {
                const token = jwt.sign(
                    { sub: userResult.user._id, name: userResult.user.name, email: userResult.user.email },
                    process.env.JWT_SECRET || "",
                    { expiresIn: "7d" }
                );
                const cookieStore = await cookies();
                cookieStore.set("token", token, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === "production",
                    sameSite: "strict",
                    maxAge: 7 * 24 * 60 * 60,
                    path: "/",
                });
            }
        }
        return NextResponse.json(result,{ status: result.success ? 200 : 400 });
    }
    catch(error){
        return NextResponse.json({ message: "Error verifying OTP: "+error, success: false },{ status: 500 });
    }
}