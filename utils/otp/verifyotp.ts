import setConnectionRedis from "./connectRedis";

// Maximum failed OTP attempts before the key is invalidated.
const MAX_OTP_ATTEMPTS = 5;

export const verifyOtp = async (key: string, otp: string): Promise<{ message: string; success: boolean }> => {
    try{
        const redisClient = await setConnectionRedis();

        // Brute-force protection: track failed attempts.
        const attemptKey = `otp_attempts:${key}`;
        const attempts = await redisClient.get(attemptKey);
        if (attempts && parseInt(attempts) >= MAX_OTP_ATTEMPTS) {
            // Invalidate the OTP so it can't be used even if guessed.
            await redisClient.del(key);
            return { message: "Too many failed attempts. Please request a new OTP.", success: false };
        }

        const storedOtp = await redisClient.get(key);

        if (!storedOtp) {
            return { message: "OTP not found or expired", success: false };
        }

        if (storedOtp !== otp) {
            // Increment the attempt counter, expire it alongside the OTP TTL.
            const remaining = await redisClient.ttl(key);
            await redisClient.set(attemptKey, String((parseInt(attempts ?? "0") + 1)), "EX", remaining > 0 ? remaining : 300);
            return { message: "Invalid OTP", success: false };
        }

        // Clean up on success.
        await redisClient.del(key);
        await redisClient.del(attemptKey);
        return { message: "OTP verified successfully", success: true };
    }
    catch(error){
        console.error("Error verifying OTP:", error);
        return { message: "Error verifying OTP: " + error, success: false };
    }
}