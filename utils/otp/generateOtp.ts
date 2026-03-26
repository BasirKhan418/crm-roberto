
import setConnectionRedis from "./connectRedis";

export const generateOtp = async (key: string, otp: string, ttl: number)=>{
    try{
        const redisClient = await setConnectionRedis();
        //rate limiting: per user can request otp only 5 times in 5 minutes
        const userOtpCount = await redisClient.incr(`otp_count:${key}`);
        if(userOtpCount > 5){
            return { message: "Too many OTP requests. Please try again later.", success: false };
        }
        await redisClient.set(key, otp, "EX", ttl);
        return { message: "OTP generated and stored successfully", success: true ,data: { key, otp }};
    }
    catch(error){
        console.error("Error generating OTP:", error);
        return { message: "Error generating OTP: " + error, success: false };
    }
}