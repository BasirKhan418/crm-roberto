
import setConnectionRedis from "./connectRedis";

export const generateOtp = async (key: string, otp: string, ttl: number)=>{
    try{
        const redisClient = await setConnectionRedis();
        const RATE_LIMIT_WINDOW_SECONDS = 5 * 60;
        const MAX_OTP_REQUESTS_PER_WINDOW = 5;

        // Rate limiting: per user can request OTP only 5 times per 5-minute window.
        // The counter key expires after 5 minutes so the window resets automatically.
        const countKey = `otp_count:${key}`;
        const userOtpCount = await redisClient.incr(countKey);
        if (userOtpCount === 1) {
            // First request in this window — set the 5-minute expiry on the counter.
            await redisClient.expire(countKey, RATE_LIMIT_WINDOW_SECONDS);
        }

        if(userOtpCount > MAX_OTP_REQUESTS_PER_WINDOW){
            const retryAfterSeconds = await redisClient.ttl(countKey);
            return {
                message: "Too many OTP requests. Max 5 requests per 5 minutes. Please try again after 5 minutes.",
                success: false,
                retryAfterSeconds: retryAfterSeconds > 0 ? retryAfterSeconds : RATE_LIMIT_WINDOW_SECONDS,
            };
        }

        await redisClient.set(key, otp, "EX", ttl);
        return { message: "OTP generated and stored successfully", success: true ,data: { key, otp }};
    }
    catch(error){
        console.error("Error generating OTP:", error);
        return { message: "Error generating OTP: " + error, success: false };
    }
}