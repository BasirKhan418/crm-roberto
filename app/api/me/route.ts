import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import ConnectDb from "@/db/connectDb";
import User from "@/db/models/User";
import checkMe from "@/utils/middlewares/checkMe";

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const withUserFetch = searchParams.get("fch") !== null;

        const me = await checkMe(withUserFetch);
        if (!me.success || !me.user) {
            const cookieStore = await cookies();
            cookieStore.delete("token");

            const lowerMessage = typeof me.message === "string" ? me.message.toLowerCase() : "";
            const isForbiddenState =
                lowerMessage.includes("suspended") ||
                lowerMessage.includes("revoked") ||
                lowerMessage.includes("locked");
            return NextResponse.json(
                { message: me.message || "Unauthorized", success: false },
                { status: isForbiddenState ? 403 : 401 }
            );
        }

        return NextResponse.json({
            message: me.message || "User data fetched successfully",
            success: true,
            user: me.user,
        });
    } catch (error) {
        return NextResponse.json({ message: "Error fetching user data" + error, success: false }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const me = await checkMe(true);
        if (!me.success || !me.user) {
            return NextResponse.json({ message: me.message || "Unauthorized", success: false }, { status: 401 });
        }

        const payload = await request.json().catch(() => null) as { locale?: unknown } | null;
        const nextLocale = payload?.locale;

        if (nextLocale !== "en" && nextLocale !== "fr") {
            return NextResponse.json({ message: "Invalid locale", success: false }, { status: 400 });
        }

        await ConnectDb();
        await User.findByIdAndUpdate(me.user.id, { locale: nextLocale });

        return NextResponse.json({
            message: "Locale updated successfully",
            success: true,
            user: {
                ...me.user,
                locale: nextLocale,
            },
        });
    } catch (error) {
        return NextResponse.json({ message: "Error updating locale" + error, success: false }, { status: 500 });
    }
}