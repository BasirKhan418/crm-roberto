import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { getAllUsers, updateAccountStatus } from "@/db/repository/admin";
import { emitAccountStatusChanged } from "@/lib/account-status-events";
import { updateAccountStatusSchema } from "@/validators/admin.schema";
import { buildValidationError } from "@/utils/api/validation";

async function verifyAdminToken(): Promise<{ sub: string } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin-token")?.value;
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "") as {
      sub: string;
      kind?: string;
    };
    if (decoded.kind !== "admin") return null;
    return decoded;
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const admin = await verifyAdminToken();
    if (!admin) {
      return NextResponse.json({ message: "Forbidden", success: false }, { status: 403 });
    }
    const result = await getAllUsers();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { message: "Error fetching users: " + error, success: false },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const admin = await verifyAdminToken();
    if (!admin) {
      return NextResponse.json({ message: "Forbidden", success: false }, { status: 403 });
    }

    const body = await request.json();
    const validation = updateAccountStatusSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(buildValidationError(validation.error), { status: 400 });
    }

    const { userId, account_status } = validation.data;

    const result = await updateAccountStatus(userId, account_status);

    if (result.success) {
      emitAccountStatusChanged({
        userId,
        account_status,
        at: Date.now(),
      });
    }

    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    return NextResponse.json(
      { message: "Error updating account status: " + error, success: false },
      { status: 500 }
    );
  }
}
