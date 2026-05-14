import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import ConnectDb from "@/db/connectDb";
import User from "@/db/models/User";
import { ensureUserCompanyContext } from "@/db/repository/company";

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
              return { message: "No token found", success: false }
          }
          try{
                            const decoded = jwt.verify(token, process.env.JWT_SECRET || "") as JwtUserPayload;

                            await ConnectDb();
                            const user = await User.findById(decoded.sub)
                                .select("name email locale isOnboardingComplete isEmailVerified account_status role companyId accessRevokedAt forceLogoutAfter lockedUntil")
                                .lean<DbUserProjection | null>();

                            if (!user) {
                                return { message: "User not found", success: false };
                            }

                            const now = new Date();

                            if (user.account_status === "suspended") {
                                return {
                                    message: "Your account has been suspended. Please contact support.",
                                    success: false,
                                };
                            }

                            if (user.accessRevokedAt && user.accessRevokedAt <= now) {
                                return {
                                    message: "Your access has been revoked. Please contact support.",
                                    success: false,
                                };
                            }

                            if (user.lockedUntil && user.lockedUntil > now) {
                                return {
                                    message: "Your account is temporarily locked. Please try again later.",
                                    success: false,
                                };
                            }

                            const tokenIssuedAt = decoded.iat ? new Date(decoded.iat * 1000) : null;
                            if (tokenIssuedAt && user.forceLogoutAfter && tokenIssuedAt <= user.forceLogoutAfter) {
                                return {
                                    message: "Session expired. Please login again.",
                                    success: false,
                                };
                            }

                            let role = user.role;
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

                                role = ensured.role;
                                companyId = ensured.companyId || null;
                            }

                            if(fch){
                                            return { message: "User data fetched successfully", success: true, user: { id: String(user._id), name: user.name, email: user.email, locale: user.locale, isOnboardingComplete: user.isOnboardingComplete, isEmailVerified: user.isEmailVerified, role, companyId } };
                            }
                            return { message: "User data fetched successfully", success: true, user: { id: String(user._id), name: user.name, email: user.email, locale: user.locale, isOnboardingComplete: user.isOnboardingComplete, isEmailVerified: user.isEmailVerified, role, companyId } };
          }
          catch{
              return { message: "Invalid token", success: false };
          }
  
      }
      catch(error){
          return { message: "Error fetching user data"+error, success: false };
      }
}

export default checkMe;