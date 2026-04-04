import { NextResponse,NextRequest } from "next/server";
import { createCompanyProfileSchema } from "@/validators/cprofile.schema";
import checkMe from "@/utils/middlewares/checkMe";
import { createCompanyProfile, getCompanyProfileByUserId, updateCompanyProfileByUserId } from "@/db/repository/cprofile";
import { buildValidationError } from "@/utils/api/validation";
import getMe from "@/utils/middlewares/useMe";
import User from "@/db/models/User";
import ConnectDb from "@/db/connectDb";
import { sendWelcomeEmail } from "@/emails/auth/sendWelcomeEmail";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
export const POST = async (request: NextRequest) => {
    try{
        const  data = await request.json();
        
        const rs = await checkMe(true);
        console.log("checkMe result in cprofile route:", rs);
        if(!rs.success){
            return NextResponse.json({ message: "Unauthorized", success: false }, { status: 401 });
        }
        if(!rs.user){
            return NextResponse.json({ message: "User not found", success: false }, { status: 401 });
        }
        const validatedData = createCompanyProfileSchema.safeParse({ ...data, user: rs.user.id });

        if (!validatedData.success) {
            return NextResponse.json(buildValidationError(validatedData.error), { status: 400 });
        }

        // Check if a company profile already exists for this user
        const existing = await getCompanyProfileByUserId(rs.user.id);
        let result;
        if (existing.success) {
            // Profile already exists — update it instead of creating a duplicate
            result = await updateCompanyProfileByUserId(rs.user.id, validatedData.data);
            // Ensure User.isOnboardingComplete is synced in DB (may be stale from a previous partial failure)
            await ConnectDb();
            await User.findByIdAndUpdate(rs.user.id, { isOnboardingComplete: true });
        } else {
            result = await createCompanyProfile(validatedData.data);
        }

        if (!result.success) {
            return NextResponse.json(result, { status: 500 });
        }

        // Only send welcome email on first creation
        if (!existing.success) {
            await sendWelcomeEmail({ email: rs.user.email, name: rs.user.name || "User" });
        }

        // Reissue JWT with isOnboardingComplete: true so proxy.ts reads the updated value
        const newToken = jwt.sign(
            { sub: rs.user.id, name: rs.user.name, email: rs.user.email, isOnboardingComplete: true, isEmailVerified: rs.user.isEmailVerified },
            process.env.JWT_SECRET || "",
            { expiresIn: "7d" }
        );
        const cookieStore = await cookies();
        cookieStore.set("token", newToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            maxAge: 7 * 24 * 60 * 60,
            path: "/",
        });
        return NextResponse.json(result);
    }
    catch(error){
        return NextResponse.json({ message: "Error creating company profile"+error, success: false });
    }
}

export const GET = async () => {
    try {
        const me = await getMe(true);
        if (!me.success || !me.user) {
            return NextResponse.json({ message: me.message || "Unauthorized", success: false }, { status: 401 });
        }

        const result = await getCompanyProfileByUserId(me.user.id);
        if (!result.success) {
            return NextResponse.json(result, { status: 404 });
        }

        return NextResponse.json(result);
    }
    catch (error) {
        return NextResponse.json({ message: "Error fetching company profile" + error, success: false }, { status: 500 });
    }
}

export const PATCH = async (request: NextRequest) => {
    try {
        const me = await getMe(true);
        if (!me.success || !me.user) {
            return NextResponse.json({ message: me.message || "Unauthorized", success: false }, { status: 401 });
        }

        const data = await request.json();
        const sanitizedData = { ...data };
        delete sanitizedData.user;
        delete sanitizedData.logoUrl;
        delete sanitizedData.logoKey;

        const result = await updateCompanyProfileByUserId(me.user.id, sanitizedData);
        if (!result.success) {
            return NextResponse.json(result, { status: 404 });
        }

        return NextResponse.json(result);
    }
    catch (error) {
        return NextResponse.json({ message: "Error updating company profile" + error, success: false }, { status: 500 });
    }
}