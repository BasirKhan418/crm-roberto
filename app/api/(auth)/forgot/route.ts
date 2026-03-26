import { NextResponse,NextRequest } from "next/server";
import jwt from "jsonwebtoken";
import { generateOtp } from "@/utils/otp/generateOtp";
import { verifyOtp } from "@/utils/otp/verifyotp";
import getUserByEmail from "@/db/repository/getUserByEmail";
import { SendForgotPasswordEmail } from "@/emails/auth/forgotEmail";
import { forgotPasswordSchema } from "@/validators/forgot.schema";
export async function POST(request: NextRequest) {
    try{
        const { email ,status,otp} = await request.json();
        //payload validation
        const parseResult = forgotPasswordSchema.safeParse({ email, status, otp });
        if (!parseResult.success) {
            return NextResponse.json({ message: parseResult.error.issues[0].message, success: false },{ status: 400 });
        }
        //handle forgot password request
        if(status === "forgot"){
            const userResult = await getUserByEmail(email);
            if(!userResult.success){
                return NextResponse.json({ message: userResult.message, success: false },{ status: 404 });
            }
            const otp = Math.floor(100000 + Math.random() * 900000).toString();
            const ttl = 5 * 60; // OTP valid for 5 minutes
            const result = await generateOtp(`forgot:${email}`, otp, ttl);
            SendForgotPasswordEmail({ email, otp });
            return NextResponse.json({ message: "Forgot password email sent successfully", success: true },{ status: 200 });
        }
        //handle otp verification for forgot password
        
        const verifyResult = await verifyOtp(`forgot:${email}`, otp);
        const token = jwt.sign({ email }, process.env.JWT_SECRET ||"", { expiresIn: '15m' });
        if(verifyResult.success){
            return NextResponse.json({ message: "OTP verified successfully", success: true, token },{ status: 200 });
        }
        return NextResponse.json({ message: verifyResult.message, success: false },{ status: 400 });
        
    }
    catch(error){
        return NextResponse.json({ message: "Error occurred while processing forgot password request: "+error, success: false },{ status: 500 });
    }
}