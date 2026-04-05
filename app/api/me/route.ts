import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import checkMe from "@/utils/middlewares/checkMe";

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const withUserFetch = searchParams.get("fch") !== null;

        const me = await checkMe(withUserFetch);
        if (!me.success || !me.user) {
            const cookieStore = await cookies();
            cookieStore.delete("token");

            const isSuspended = typeof me.message === "string" && me.message.toLowerCase().includes("suspended");
            return NextResponse.json(
                { message: me.message || "Unauthorized", success: false },
                { status: isSuspended ? 403 : 401 }
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