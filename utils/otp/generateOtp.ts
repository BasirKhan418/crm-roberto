
import setConnectionRedis from "./connectRedis";

const RATE_LIMIT_WINDOW_SECONDS = 5 * 60;
const MAX_OTP_REQUESTS_PER_WINDOW = 5;
const RESEND_COOLDOWN_SECONDS = 30;

type GenerateOtpSuccessResult = {
    success: true;
    message: string;
};

type GenerateOtpErrorReason = "rate_limit" | "cooldown" | "store_unavailable";

type GenerateOtpErrorResult = {
    success: false;
    reason: GenerateOtpErrorReason;
    message: string;
    retryAfterSeconds?: number;
};

export type GenerateOtpResult = GenerateOtpSuccessResult | GenerateOtpErrorResult;

export const generateOtp = async (key: string, otp: string, ttl: number): Promise<GenerateOtpResult> => {
    try{
        const redisClient = setConnectionRedis();
        if (redisClient.status === "wait") {
            await redisClient.connect();
        }

        // Rate limiting: per user can request OTP only 5 times per 5-minute window.
        // The counter key expires after 5 minutes so the window resets automatically.
        const countKey = `otp_count:${key}`;
        const cooldownKey = `otp_cooldown:${key}`;
        const attemptKey = `otp_attempts:${key}`;

        const [cooldownTtl, currentCountRaw] = await Promise.all([
            redisClient.ttl(cooldownKey),
            redisClient.get(countKey),
        ]);

        if (cooldownTtl > 0) {
            return {
                message: `Please wait ${cooldownTtl} seconds before requesting another OTP.`,
                success: false,
                reason: "cooldown",
                retryAfterSeconds: cooldownTtl,
            };
        }

        const currentCount = Number.parseInt(currentCountRaw ?? "0", 10);

        // IMPORTANT: do not increment on blocked requests; otherwise failures inflate the counter.
        if(currentCount >= MAX_OTP_REQUESTS_PER_WINDOW){
            const retryAfterSeconds = await redisClient.ttl(countKey);
            return {
                message: "Too many OTP requests. Max 5 requests per 5 minutes. Please try again after 5 minutes.",
                success: false,
                reason: "rate_limit",
                retryAfterSeconds: retryAfterSeconds > 0 ? retryAfterSeconds : RATE_LIMIT_WINDOW_SECONDS,
            };
        }

        await redisClient.incr(countKey);
        const countTtl = await redisClient.ttl(countKey);

        // Self-heal if TTL is missing (-1) or key is unexpectedly gone (-2).
        if (countTtl <= 0) {
            await redisClient.expire(countKey, RATE_LIMIT_WINDOW_SECONDS);
        }

        await Promise.all([
            redisClient.set(key, otp, "EX", ttl),
            redisClient.set(cooldownKey, "1", "EX", RESEND_COOLDOWN_SECONDS),
            redisClient.del(attemptKey),
        ]);

        return { message: "OTP generated and stored successfully", success: true };
    }
    catch(error){
        console.error("Error generating OTP:", error);
        return {
            message: "OTP service is temporarily unavailable. Please try again in a moment.",
            success: false,
            reason: "store_unavailable",
        };
    }
}