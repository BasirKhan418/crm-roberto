import { cookies } from "next/headers";
import jwt, { JsonWebTokenError, NotBeforeError, TokenExpiredError } from "jsonwebtoken";

import ConnectDb from "@/db/connectDb";
import User from "@/db/models/User";
import { requireCompanyFeature } from "@/lib/company-features";
import { createI18nKey as i18nKey } from "@/lib/i18n/messages";

type AccountantJwtPayload = {
  sub: string;
  email?: string;
  name?: string;
  locale?: "en" | "fr";
  companyId?: string | null;
  role?: string;
  kind?: string;
  iat?: number;
};

type AccountantDbUserProjection = {
  _id: string;
  name: string;
  email: string;
  locale?: "en" | "fr";
  role?: string;
  companyId?: string | null;
  account_status?: "active" | "suspended";
  accessRevokedAt?: Date | null;
  forceLogoutAfter?: Date | null;
  lockedUntil?: Date | null;
};

export interface AccountantSessionUser {
  id: string;
  name: string;
  email: string;
  locale?: "en" | "fr";
  role: "external_accountant";
  companyId: string;
}

type AccountantSessionResult = {
  success: boolean;
  message: string;
  user?: AccountantSessionUser;
};

export default async function getAccountantSession(): Promise<AccountantSessionResult> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("accountant-token")?.value;

    if (!token) {
      return { success: false, message: i18nKey("auth.noToken") };
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return { success: false, message: i18nKey("auth.invalidToken") };
    }

    try {
      const decoded = jwt.verify(token, jwtSecret) as AccountantJwtPayload;

      if (decoded.kind !== "accountant_portal") {
        return { success: false, message: i18nKey("auth.invalidToken") };
      }

      await ConnectDb();
      const user = await User.findById(decoded.sub)
        .select("name email locale role companyId account_status accessRevokedAt forceLogoutAfter lockedUntil")
        .lean<AccountantDbUserProjection | null>();

      if (!user) {
        return { success: false, message: i18nKey("auth.userNotFound") };
      }

      const now = new Date();

      if (user.account_status === "suspended") {
        return { success: false, message: i18nKey("auth.accountSuspended") };
      }

      if (user.accessRevokedAt && user.accessRevokedAt <= now) {
        return { success: false, message: i18nKey("auth.accountRevoked") };
      }

      if (user.lockedUntil && user.lockedUntil > now) {
        return { success: false, message: i18nKey("auth.accountTemporarilyLocked") };
      }

      const tokenIssuedAt = decoded.iat ? new Date(decoded.iat * 1000) : null;
      if (tokenIssuedAt && user.forceLogoutAfter && tokenIssuedAt <= user.forceLogoutAfter) {
        return { success: false, message: i18nKey("auth.sessionExpired") };
      }

      if (user.role !== "external_accountant" || !user.companyId) {
        return { success: false, message: "Forbidden" };
      }

      const featureCheck = await requireCompanyFeature(String(user.companyId), "accountantPortal");
      if (!featureCheck.success) {
        return { success: false, message: featureCheck.message };
      }

      return {
        success: true,
        message: i18nKey("auth.userFetched"),
        user: {
          id: String(user._id),
          name: user.name,
          email: user.email,
          locale: user.locale,
          role: "external_accountant",
          companyId: String(user.companyId),
        },
      };
    } catch (error) {
      if (error instanceof TokenExpiredError || error instanceof NotBeforeError || error instanceof JsonWebTokenError) {
        return { success: false, message: i18nKey("auth.invalidToken") };
      }

      console.error("getAccountantSession token validation failed", error);
      return { success: false, message: i18nKey("auth.invalidToken") };
    }
  } catch (error) {
    console.error("getAccountantSession failed", error);
    return { success: false, message: i18nKey("auth.fetchUserError") };
  }
}