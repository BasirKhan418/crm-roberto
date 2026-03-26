
import setConnectionRedis from "./connectRedis";

export const generateOtp = async (key: string, otp: string, ttl: number)=>{
    try{
        const redisClient = await setConnectionRedis();
        // Rate limiting: per user can request OTP only 5 times per 5-minute window.
        // The counter key expires after 5 minutes so the window resets automatically.
        const countKey = `otp_count:${key}`;
        const userOtpCount = await redisClient.incr(countKey);
        if (userOtpCount === 1) {
            // First request in this window — set the 5-minute expiry on the counter.
            await redisClient.expire(countKey, 5 * 60);
        }
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