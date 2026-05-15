import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import ConnectDb from "@/db/connectDb";
import Company from "@/db/models/Company";
import User from "@/db/models/User";
import { ensureUserCompanyContext } from "@/db/repository/company";
import { createI18nKey as i18nKey } from "@/lib/i18n/messages";
import { normalizeRole, type AppRole } from "@/lib/permissions";

interface JwtUserPayload {
    sub: string;
    name: string;
    email: string;
    locale?: 'en' | 'fr';
    isOnboardingComplete?: boolean;
    isEmailVerified?: boolean;
    role?: string;
    companyId?: string | null;
    iat?: number;
}

interface DbUserProjection {
    _id: string;
    name: string;
    email: string;
    locale?: 'en' | 'fr';
    isOnboardingComplete?: boolean;
    isEmailVerified?: boolean;
    account_status?: "active" | "suspended";
    role?: string;
    companyId?: string | null;
    accessRevokedAt?: Date | null;
    forceLogoutAfter?: Date | null;
    lockedUntil?: Date | null;
}

const checkMe = async (fch:boolean) => {
    try{
            const cookieStore = await cookies();
          const token = cookieStore.get("token")?.value;
          if(!token){
              return { message: i18nKey("auth.noToken"), success: false }
          }
          try{
                            const decoded = jwt.verify(token, process.env.JWT_SECRET || "") as JwtUserPayload;

                            await ConnectDb();
                            const user = await User.findById(decoded.sub)
                                .select("name email locale isOnboardingComplete isEmailVerified account_status role companyId accessRevokedAt forceLogoutAfter lockedUntil")
                                .lean<DbUserProjection | null>();

                            if (!user) {
                                return { message: i18nKey("auth.userNotFound"), success: false };
                            }

                            const now = new Date();

                            if (user.account_status === "suspended") {
                                return {
                                    message: i18nKey("auth.accountSuspended"),
                                    success: false,
                                };
                            }

                            if (user.accessRevokedAt && user.accessRevokedAt <= now) {
                                return {
                                    message: i18nKey("auth.accountRevoked"),
                                    success: false,
                                };
                            }

                            if (user.lockedUntil && user.lockedUntil > now) {
                                return {
                                    message: i18nKey("auth.accountTemporarilyLocked"),
                                    success: false,
                                };
                            }

                            const tokenIssuedAt = decoded.iat ? new Date(decoded.iat * 1000) : null;
                            if (tokenIssuedAt && user.forceLogoutAfter && tokenIssuedAt <= user.forceLogoutAfter) {
                                return {
                                    message: i18nKey("auth.sessionExpired"),
                                    success: false,
                                };
                            }

                            let role: AppRole = normalizeRole(user.role);
                            let companyId = user.companyId ? String(user.companyId) : null;

                            if (!companyId) {
                                const ensured = await ensureUserCompanyContext({
                                    userId: String(user._id),
                                    fallbackName: user.name,
                                    fallbackEmail: user.email,
                                });

                                if (!ensured.success) {
                                    return { message: ensured.message, success: false };
                                }

                                role = normalizeRole(ensured.role) as AppRole;
                                companyId = ensured.companyId || null;
                            } else if (role !== "super_admin") {
                                const company = await Company.findById(companyId)
                                    .select("ownerUserId")
                                    .lean<{ ownerUserId?: string | null } | null>();

                                const isCompanyOwner = Boolean(
                                    company?.ownerUserId && String(company.ownerUserId) === String(user._id)
                                );

                                if (isCompanyOwner && role !== "administrator") {
                                    role = "administrator";
                                    await User.updateOne({ _id: user._id }, { $set: { role } });
                                }
                            }

                            if(fch){
                                            return { message: i18nKey("auth.userFetched"), success: true, user: { id: String(user._id), name: user.name, email: user.email, locale: user.locale, isOnboardingComplete: user.isOnboardingComplete, isEmailVerified: user.isEmailVerified, role, companyId } };
                            }
                            return { message: i18nKey("auth.userFetched"), success: true, user: { id: String(user._id), name: user.name, email: user.email, locale: user.locale, isOnboardingComplete: user.isOnboardingComplete, isEmailVerified: user.isEmailVerified, role, companyId } };
          }
          catch(error){
              console.error("checkMe token validation failed", error);
              return { message: i18nKey("auth.invalidToken"), success: false };
          }
  
      }
      catch(error){
          console.error("checkMe failed", error);
          return { message: i18nKey("auth.fetchUserError"), success: false };
      }
}

export default checkMe;