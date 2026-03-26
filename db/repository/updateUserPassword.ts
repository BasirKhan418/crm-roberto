import ConnectDb from "../connectDb"
import argon2 from "argon2";
import User from "../models/User"
const updateUserPassword = async (email: string, hashedPassword: string) => {
    try {
        await ConnectDb();
        const user = await User.findOneAndUpdate({ email }, { password: hashedPassword });
        if (!user) {
            return { message: "User not found", success: false };
        }
        return { message: "Password updated successfully", success: true };
    }
    catch(error){
        console.error("Error updating user password:", error);
        return { message: "Error updating user password: " + error, success: false };
    }
}

export const updateUserPasswordWithCurrent = async (
    email: string,
    currentPassword: string,
    newPassword: string
) => {
    try {
        await ConnectDb();

        const user = await User.findOne({ email, isEmailVerified: true }).select("+password");
        if (!user) {
            return { message: "User not found", success: false };
        }

        const pepper = process.env.PASSWORD_PEPPER;
        const isValid = await argon2.verify(user.password, currentPassword + pepper);
        if (!isValid) {
            return { message: "Current password is incorrect", success: false };
        }

        const newHashedPassword = await argon2.hash(newPassword + pepper);
        user.password = newHashedPassword;
        await user.save();

        return { message: "Password updated successfully", success: true };
    }
    catch (error) {
        console.error("Error updating user password with current password:", error);
        return { message: "Error updating password: " + error, success: false };
    }
};

export default updateUserPassword;