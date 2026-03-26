import { NextResponse,NextRequest } from "next/server";
import { verifyOtp } from "@/utils/otp/verifyotp";
import { markEmailAsVerified } from "@/db/repository/auth";
export async function POST(request: NextRequest) {
    try{
        const { email, otp } = await request.json();
        const result = await verifyOtp(email, otp);
        if(result.success){
            await markEmailAsVerified(email);
        }
        return NextResponse.json(result,{ status: result.success ? 200 : 400 });
    }
    catch(error){
        return NextResponse.json({ message: "Error verifying OTP: "+error, success: false },{ status: 500 });
    }
}