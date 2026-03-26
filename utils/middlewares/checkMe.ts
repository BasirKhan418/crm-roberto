import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import getUserByEmail from "@/db/repository/getUserByEmail";
const checkMe = async (fch:boolean) => {
    try{
            const cookieStore = await cookies();
          const token = cookieStore.get("token")?.value;
          if(!token){
              return { message: "No token found", success: false }
          }
          try{
              const decoded = jwt.verify(token, process.env.JWT_SECRET || "") as { sub: string, name: string, email: string };
              console.log("Decoded token:", decoded);
              if(fch){
                  const user = await getUserByEmail(decoded.email);
                  if(user.success){
                      return { message: "User data fetched successfully", success: true, user: { id: decoded.sub, name: decoded.name, email: decoded.email, isOnboardingComplete: user.user.isOnboardingComplete,isEmailVerified: user.user.isEmailVerified } };
                  }
              }
              return { message: "User data fetched successfully", success: true, user: { id: decoded.sub, name: decoded.name, email: decoded.email } };
          }
          catch(error){
              return { message: "Invalid token", success: false };
          }
  
      }
      catch(error){
          return { message: "Error fetching user data"+error, success: false };
      }
}

export default checkMe;