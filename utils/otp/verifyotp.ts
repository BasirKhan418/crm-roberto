import setConnectionRedis from "./connectRedis";

export const verifyOtp = async (key: string, otp: string): Promise<{ message: string; success: boolean }> => {
    try{
        const redisClient = await setConnectionRedis();
        const storedOtp = await redisClient.get(key);

        if (!storedOtp) {
            return { message: "OTP not found or expired", success: false };
        }

        if (storedOtp !== otp) {
            return { message: "Invalid OTP", success: false };
        }

        await redisClient.del(key);
        return { message: "OTP verified successfully", success: true };
    }
    catch(error){
        console.error("Error verifying OTP:", error);
        return { message: "Error verifying OTP: " + error, success: false };
    }
}