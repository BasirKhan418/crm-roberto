import { NextResponse,NextRequest } from "next/server";
import { verifyOtp } from "@/utils/otp/verifyotp";

export async function POST(request: NextRequest) {
    try{
        const { email, otp } = await request.json();
        const result = await verifyOtp(email, otp);
        return NextResponse.json(result,{ status: result.success ? 200 : 400 });
    }
    catch(error){
        return NextResponse.json({ message: "Error verifying OTP: "+error, success: false },{ status: 500 });
    }
}