import { NextResponse,NextRequest } from "next/server";
import jwt from "jsonwebtoken";
import argon2 from "argon2";
import { resetPasswordSchema } from "@/validators/forgot.schema";
import updateUserPassword from "@/db/repository/updateUserPassword";
export async function POST(request: NextRequest) {
    try{
        const { email, password, token } = await request.json();
        const parseResult = resetPasswordSchema.safeParse({ email, password, token });
        if (!parseResult.success) {
            return NextResponse.json({ message: parseResult.error.issues[0].message, success: false },{ status: 400 });
        }
        //verify token
        try{
            const decoded = jwt.verify(token, process.env.JWT_SECRET ||"") as { email: string };
            if(decoded.email !== email){
                return NextResponse.json({ message: "Session expired, please request a new one", success: false },{ status: 400 });
            }
                //update password in db
                const pepper = process.env.PASSWORD_PEPPER;
                const hashedPassword = await argon2.hash(password + pepper);
                //update password in db
                // Assuming you have a function updateUserPassword that takes email and new hashed password
                const updateResult = await updateUserPassword(email, hashedPassword);
                return NextResponse.json(updateResult, { status: updateResult.success ? 200 : 400 });

        }
        catch(error){
            return NextResponse.json({ message: "Invalid or expired session,Please request a new one", success: false },{ status: 400 });
        }
        
    }
    catch(error){
        return NextResponse.json({ message: "Error occurred while processing reset password request: "+error, success: false },{ status: 500 });
    }
}