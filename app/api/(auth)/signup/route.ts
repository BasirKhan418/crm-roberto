import { NextResponse,NextRequest } from "next/server";
import argon2 from "argon2";
import { signupSchema } from "@/validators/auth.schema";
import { registerUser } from "@/db/repository/auth";
export async function POST(request: NextRequest) {
    try{
        const pepper = process.env.PASSWORD_PEPPER;
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
        return NextResponse.json(result);   
    }
    catch(error){
        return NextResponse.json({ message: "Error registering user"+error, success: false });
    }
}