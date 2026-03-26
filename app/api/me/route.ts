import { NextResponse,NextRequest } from "next/server";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import getUserByEmail from "@/db/repository/getUserByEmail";
export async function GET(request: NextRequest) {
    try{
        const cookieStore = await cookies();
        const searchParams = request.nextUrl.searchParams;
        const fch = searchParams.get("fch");
        const token = cookieStore.get("token")?.value;
        if(!token){
            return NextResponse.json({ message: "No token found", success: false }, { status: 401 });
        }
        try{
            const decoded = jwt.verify(token, process.env.JWT_SECRET || "") as { sub: string, name: string, email: string };
            console.log("Decoded token:", decoded);
            if(fch){
                const user = await getUserByEmail(decoded.email);
                if(user.success){
                    return NextResponse.json({ message: "User data fetched successfully", success: true, user: { id: decoded.sub, name: decoded.name, email: decoded.email, isOnboardingComplete: user.user.isOnboardingComplete } });
                }
            }
            return NextResponse.json({ message: "User data fetched successfully", success: true, user: { id: decoded.sub, name: decoded.name, email: decoded.email } });
        }
        catch(error){
            return NextResponse.json({ message: "Invalid token", success: false }, { status: 401 });
        }

    }
    catch(error){
        return NextResponse.json({ message: "Error fetching user data"+error, success: false });
    }
}