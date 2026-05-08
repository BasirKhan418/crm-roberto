import { NextResponse,NextRequest } from "next/server";
import { createCompanyProfileInputSchema, createCompanyProfileSchema, updateCompanyProfileSchema } from "@/validators/cprofile.schema";
import { createCompanyProfile, getCompanyProfileByUserId, updateCompanyProfileByUserId } from "@/db/repository/cprofile";
import { buildValidationError } from "@/utils/api/validation";
import getMe from "@/utils/middlewares/useMe";
import User from "@/db/models/User";
import ConnectDb from "@/db/connectDb";
import { sendWelcomeEmail } from "@/emails/auth/sendWelcomeEmail";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { resolveLocaleFromRequest } from "@/lib/i18n/locale";
export const POST = async (request: NextRequest) => {
    try{
        const data = await request.json() as Record<string, unknown>;
        const locale = resolveLocaleFromRequest(request, {
            rawLocale: typeof data.locale === "string" ? data.locale : null,
        });

        const me = await getMe(true);
        if(!me.success || !me.user){
            return NextResponse.json({ message: me.message || "Unauthorized", success: false }, { status: 401 });
        }

        const parsedInput = createCompanyProfileInputSchema.safeParse(data);
        if (!parsedInput.success) {
            return NextResponse.json(buildValidationError(parsedInput.error), { status: 400 });
        }

        const validatedData = createCompanyProfileSchema.safeParse({ ...parsedInput.data, user: me.user.id });

        if (!validatedData.success) {
            return NextResponse.json(buildValidationError(validatedData.error), { status: 400 });
        }

        const existing = await getCompanyProfileByUserId(me.user.id);
        const profileExists = existing.success && !!existing.profile;
        const isNotFound = !existing.success && existing.message === "Company profile not found";

        if (!profileExists && !isNotFound) {
            return NextResponse.json({ message: existing.message || "Unable to verify company profile", success: false }, { status: 500 });
        }

        let result;
        if (profileExists) {
            result = await updateCompanyProfileByUserId(me.user.id, parsedInput.data);
        } else {
            result = await createCompanyProfile(validatedData.data);
        }

        if (!result.success) {
            return NextResponse.json(result, { status: 500 });
        }

        await ConnectDb();
        await User.findByIdAndUpdate(me.user.id, { isOnboardingComplete: true });

        if (!profileExists) {
            await sendWelcomeEmail({ email: me.user.email, name: me.user.name || "User", locale });
        }

        const newToken = jwt.sign(
            { sub: me.user.id, name: me.user.name, email: me.user.email, isOnboardingComplete: true, isEmailVerified: me.user.isEmailVerified },
            process.env.JWT_SECRET || "",
            { expiresIn: "7d" }
        );
        const cookieStore = await cookies();
        cookieStore.set("token", newToken, {
            httpOnly: true,
            secure: process.env.COOKIE_SECURE === "true",
            sameSite: "lax",
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

        const parsedUpdate = updateCompanyProfileSchema.safeParse(sanitizedData);
        if (!parsedUpdate.success) {
            return NextResponse.json(buildValidationError(parsedUpdate.error), { status: 400 });
        }

        const result = await updateCompanyProfileByUserId(me.user.id, parsedUpdate.data);
        if (!result.success) {
            return NextResponse.json(result, { status: 404 });
        }

        return NextResponse.json(result);
    }
    catch (error) {
        return NextResponse.json({ message: "Error updating company profile" + error, success: false }, { status: 500 });
    }
}
