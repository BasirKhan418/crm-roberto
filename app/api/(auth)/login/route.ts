import { NextResponse,NextRequest } from "next/server";
import argon2 from "argon2";
import { loginSchema } from "@/validators/auth.schema";
import { loginUser } from "@/db/repository/auth";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
export async function POST(request: NextRequest) {
    try{
        const cookieStore = await cookies();
        const pepper = process.env.PASSWORD_PEPPER;
        const {email, password } = await request.json();
        //validate input
        const validation = loginSchema.safeParse({ email, password });
        if (!validation.success) {
            return NextResponse.json({ message: validation.error.issues[0].message, success: false });
        }
       
        const result = await loginUser(email, password);
        //generate token and set cookie
        if(result.success){
            const token = jwt.sign({ sub: result.user._id, name: result.user.name, email: result.user.email }, process.env.JWT_SECRET || "", { expiresIn: '7d' });
            cookieStore.set("token", token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: "strict",
                maxAge: 7 * 24 * 60 * 60,
                path: "/",
            });
            return NextResponse.json({ message: result.message, success: true, isOnboardingComplete: result.user.isOnboardingComplete });
        }
        //in case of login failure, clear any existing token cookie
        cookieStore.delete("token");
        return NextResponse.json(result);
    }
    catch(error){
        return NextResponse.json({ message: "Error logging in  user"+error, success: false });
    }
}