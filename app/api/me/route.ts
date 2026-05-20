import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import ConnectDb from "@/db/connectDb";
import User from "@/db/models/User";
import { createI18nKey as i18nKey } from "@/lib/i18n/messages";
import checkMe from "@/utils/middlewares/checkMe";

const CLEAR_SESSION_MESSAGES = new Set([
    i18nKey("auth.invalidToken"),
    i18nKey("auth.sessionExpired"),
    i18nKey("auth.userNotFound"),
    i18nKey("auth.accountSuspended"),
    i18nKey("auth.accountRevoked"),
    i18nKey("auth.accountTemporarilyLocked"),
    i18nKey("auth.externalAccountantPortalOnly"),
]);

function shouldClearSessionCookie(message?: string) {
    if (!message) return false;

    const lowerMessage = message.toLowerCase();
    return (
        CLEAR_SESSION_MESSAGES.has(message) ||
        lowerMessage.includes("invalid session") ||
        lowerMessage.includes("session expired") ||
        lowerMessage.includes("user not found") ||
        lowerMessage.includes("suspended") ||
        lowerMessage.includes("revoked") ||
        lowerMessage.includes("locked") ||
        lowerMessage.includes("portal")
    );
}

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const withUserFetch = searchParams.get("fch") !== null;

        const me = await checkMe(withUserFetch);
        if (!me.success || !me.user) {
            if (shouldClearSessionCookie(me.message)) {
                const cookieStore = await cookies();
                cookieStore.delete("token");
            }

            const forbiddenStateMessages = new Set([
                i18nKey("auth.accountSuspended"),
                i18nKey("auth.accountRevoked"),
                i18nKey("auth.accountTemporarilyLocked"),
                i18nKey("auth.externalAccountantPortalOnly"),
            ]);
            const lowerMessage = typeof me.message === "string" ? me.message.toLowerCase() : "";
            const isForbiddenState =
                (typeof me.message === "string" && forbiddenStateMessages.has(me.message)) ||
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
        console.error("GET /api/me failed", error);
        return NextResponse.json(
            { message: i18nKey("auth.fetchUserError"), success: false },
            { status: 500 }
        );
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