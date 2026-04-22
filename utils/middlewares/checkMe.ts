import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import ConnectDb from "@/db/connectDb";
import User from "@/db/models/User";

interface JwtUserPayload {
    sub: string;
    name: string;
    email: string;
    locale?: 'en' | 'fr';
    isOnboardingComplete?: boolean;
    isEmailVerified?: boolean;
}

interface DbUserProjection {
    _id: string;
    name: string;
    email: string;
    locale?: 'en' | 'fr';
    isOnboardingComplete?: boolean;
    isEmailVerified?: boolean;
    account_status?: "active" | "suspended";
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
                                .select("name email locale isOnboardingComplete isEmailVerified account_status")
                                .lean<DbUserProjection | null>();

                            if (!user) {
                                return { message: "User not found", success: false };
                            }

                            if (user.account_status === "suspended") {
                                return {
                                    message: "Your account has been suspended. Please contact support.",
                                    success: false,
                                };
                            }

                            if(fch){
                                            return { message: "User data fetched successfully", success: true, user: { id: String(user._id), name: user.name, email: user.email, locale: user.locale, isOnboardingComplete: user.isOnboardingComplete, isEmailVerified: user.isEmailVerified } };
                            }
                            return { message: "User data fetched successfully", success: true, user: { id: String(user._id), name: user.name, email: user.email, locale: user.locale, isOnboardingComplete: user.isOnboardingComplete, isEmailVerified: user.isEmailVerified } };
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