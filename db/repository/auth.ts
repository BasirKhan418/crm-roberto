
import ConnectDb from "../connectDb";
import argon2 from "argon2";
import User from "../models/User";
import CompanyProfile from "../models/CompanyProfile";
import { ensureUserCompanyContext } from "@/db/repository/company";

const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

const registerUser = async (_name: string, email: string, _password: string) => {
    try{
        void _password;
        await ConnectDb();
        const existingUser = await User.findOne({ email }).select("invitationStatus");

        if (existingUser) {
            return {
                message: "Signup is invitation-only. Ask your administrator for an invitation.",
                success: false,
            };
        }

        return {
            message: "Signup is invitation-only. Ask your administrator for an invitation.",
            success: false,
        };
    }
    catch(error){
        return { message: "Error registering user"+error, success: false };
    }
};


const loginUser = async (email: string, password: string) => {
    try {
        await ConnectDb();
        const user = await User.findOne({ email, isEmailVerified: true }).select(
            "+password name email locale isOnboardingComplete isEmailVerified account_status role companyId accessRevokedAt forceLogoutAfter failedLoginCount lockedUntil"
        );

        if (!user) {
            return { message: "User not found", success: false };
        }

        const now = new Date();

        if (user.account_status === 'suspended') {
            return { message: "Your account has been suspended. Please contact support.", success: false };
        }

        if (user.accessRevokedAt && user.accessRevokedAt <= now) {
            return { message: "Your access has been revoked. Please contact support.", success: false };
        }

        if (user.lockedUntil && user.lockedUntil > now) {
            return { message: "Your account is temporarily locked. Please try again later.", success: false };
        }

        const pepper = process.env.PASSWORD_PEPPER || "";

        const isValid = await argon2.verify(
            user.password,           // stored hash
            password + pepper        // raw input + pepper
        );

        if (!isValid) {
            const failedLoginCount = Number(user.failedLoginCount || 0) + 1;
            const setLockedUntil = failedLoginCount >= MAX_FAILED_LOGIN_ATTEMPTS
                ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000)
                : null;

            await User.updateOne(
                { _id: user._id },
                {
                    $set: {
                        failedLoginCount,
                        lockedUntil: setLockedUntil,
                    },
                }
            );

            return { message: "Invalid password", success: false };
        }

        const ensuredCompany = await ensureUserCompanyContext({
            userId: String(user._id),
            fallbackName: user.name,
            fallbackEmail: user.email,
        });

        if (!ensuredCompany.success) {
            return { message: ensuredCompany.message, success: false };
        }

        user.companyId = ensuredCompany.companyId;
        user.role = ensuredCompany.role;

        // Self-heal onboarding status if a company profile already exists.
        if (!user.isOnboardingComplete) {
            const existingProfile = await CompanyProfile.exists({ user: user._id });
            if (existingProfile) {
                user.isOnboardingComplete = true;
            }
        }

        user.failedLoginCount = 0;
        user.lockedUntil = null;
        user.lastLoginAt = now;
        await user.save();

        return { message: "Login successful", success: true, user };
    } catch (error) {
        return { message: "Error logging in user" + error, success: false };
    }
};

const markEmailAsVerified = async (email: string) => {
    try {
        await ConnectDb();
        const user = await User.findOne({ email });
        if (!user) {
            return { message: "User not found", success: false };
        }
        user.isEmailVerified = true;
        if (user.account_status !== 'suspended') {
            user.account_status = 'active';
        }
        await user.save();
        return { message: "Email marked as verified", success: true };
    } catch (error) {
        return { message: "Error marking email as verified" + error, success: false };
    }
}



export { registerUser, loginUser, markEmailAsVerified };