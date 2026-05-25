import { NextResponse,NextRequest } from "next/server";
import { createConnectionLog } from "@/db/repository/connection-log";
import { loginSchema } from "@/validators/auth.schema";
import { loginUser } from "@/db/repository/auth";
import { buildValidationError } from "@/utils/api/validation";
import { cookies } from "next/headers";
import { signAuthToken } from "@/lib/auth-session";
import { createI18nKey as i18nKey } from "@/lib/i18n/messages";
import { getClientIp } from "@/utils/api/request";
export async function POST(request: NextRequest) {
    try{
        const cookieStore = await cookies();
        const {email, password } = await request.json();
        const ipAddress = getClientIp(request);
        const userAgent = request.headers.get('user-agent');
        //validate input
        const validation = loginSchema.safeParse({ email, password });
        if (!validation.success) {
            return NextResponse.json(buildValidationError(validation.error), { status: 400 });
        }
       
        const result = await loginUser(email, password);
        if(result.success){
            const token = signAuthToken(result.user);
            cookieStore.set("token", token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: "strict",
                maxAge: 7 * 24 * 60 * 60,
                path: "/",
            });
            void createConnectionLog({
                userId: String(result.user._id),
                companyId: result.user.companyId ? String(result.user.companyId) : null,
                role: result.user.role,
                eventType: 'login_success',
                ipAddress,
                userAgent,
            });
            return NextResponse.json({
                message: result.message,
                success: true,
                isOnboardingComplete: result.user.isOnboardingComplete,
            });
        }
        cookieStore.delete("token");
        void createConnectionLog({
            role: null,
            eventType: 'login_failed',
            ipAddress,
            userAgent,
        });
        return NextResponse.json(result);
    }
    catch(error){
        console.error("POST /api/(auth)/login failed", error);
        return NextResponse.json({ message: i18nKey("auth.loginError"), success: false }, { status: 500 });
    }
}