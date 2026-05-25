import setConnectionRedis from "./connectRedis";

// Maximum failed OTP attempts before the key is invalidated.
const MAX_OTP_ATTEMPTS = 5;

type VerifyOtpSuccessResult = {
    message: string;
    success: true;
};

type VerifyOtpErrorReason = "invalid_otp" | "otp_expired" | "too_many_attempts" | "store_unavailable";

type VerifyOtpErrorResult = {
    message: string;
    success: false;
    reason: VerifyOtpErrorReason;
};

export type VerifyOtpResult = VerifyOtpSuccessResult | VerifyOtpErrorResult;

export const verifyOtp = async (key: string, otp: string): Promise<VerifyOtpResult> => {
    try{
        const redisClient = setConnectionRedis();
        if (redisClient.status === "wait") {
            await redisClient.connect();
        }

        // Brute-force protection: track failed attempts.
        const attemptKey = `otp_attempts:${key}`;
        const attemptsRaw = await redisClient.get(attemptKey);
        const attempts = Number.parseInt(attemptsRaw ?? "0", 10);

        if (attempts >= MAX_OTP_ATTEMPTS) {
            // Invalidate the OTP so it can't be used even if guessed.
            await Promise.all([redisClient.del(key), redisClient.del(attemptKey)]);
            return {
                message: "Too many failed attempts. Please request a new OTP.",
                success: false,
                reason: "too_many_attempts",
            };
        }

        const storedOtp = await redisClient.get(key);

        if (!storedOtp) {
            await redisClient.del(attemptKey);
            return {
                message: "OTP not found or expired",
                success: false,
                reason: "otp_expired",
            };
        }

        if (storedOtp !== otp) {
            // Increment the attempt counter, expire it alongside the OTP TTL.
            const remaining = await redisClient.ttl(key);
            const nextAttempts = await redisClient.incr(attemptKey);
            if (nextAttempts === 1) {
                await redisClient.expire(attemptKey, remaining > 0 ? remaining : 300);
            }

            if (nextAttempts >= MAX_OTP_ATTEMPTS) {
                await Promise.all([redisClient.del(key), redisClient.del(attemptKey)]);
                return {
                    message: "Too many failed attempts. Please request a new OTP.",
                    success: false,
                    reason: "too_many_attempts",
                };
            }

            return { message: "Invalid OTP", success: false, reason: "invalid_otp" };
        }

        // Clean up on success.
        await Promise.all([redisClient.del(key), redisClient.del(attemptKey)]);
        return { message: "OTP verified successfully", success: true };
    }
    catch(error){
        console.error("Error verifying OTP:", error);
        return {
            message: "OTP verification service is temporarily unavailable. Please try again.",
            success: false,
            reason: "store_unavailable",
        };
    }
}