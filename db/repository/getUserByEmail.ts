
import ConnectDb from "../connectDb";
import User from "../models/User";
import { ensureUserCompanyContext } from "@/db/repository/company";
const getUserByEmail = async (email: string) => {
    try{
        await ConnectDb();
        const user = await User.findOne({ email ,isEmailVerified: true }).select(
            "name email locale isOnboardingComplete isEmailVerified role companyId"
        );
        if (!user) {
            return { message: "User not found", success: false };
        }

        const ensuredCompany = await ensureUserCompanyContext({
            userId: String(user._id),
            fallbackName: user.name,
            fallbackEmail: user.email,
        });

        if (!ensuredCompany.success) {
            return { message: ensuredCompany.message, success: false };
        }

        user.role = ensuredCompany.role;
        user.companyId = ensuredCompany.companyId;
        return { message: "User fetched successfully", success: true, user };
    }
    catch(error){
        return { message: "Error fetching user by email"+error, success: false };
    }
}

export default getUserByEmail;