import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
const checkMe = async (fch:boolean) => {
    try{
            const cookieStore = await cookies();
          const token = cookieStore.get("token")?.value;
          if(!token){
              return { message: "No token found", success: false }
          }
          try{
              const decoded = jwt.verify(token, process.env.JWT_SECRET || "") as { sub: string, name: string, email: string, isOnboardingComplete: boolean, isEmailVerified: boolean };
              console.log("Decoded token:", decoded);
              if(fch){
                      return { message: "User data fetched successfully", success: true, user: { id: decoded.sub, name: decoded.name, email: decoded.email, isOnboardingComplete: decoded.isOnboardingComplete, isEmailVerified: decoded.isEmailVerified } };
              }
              return { message: "User data fetched successfully", success: true, user: { id: decoded.sub, name: decoded.name, email: decoded.email, isOnboardingComplete: decoded.isOnboardingComplete, isEmailVerified: decoded.isEmailVerified } };
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