import ConnectDb from "../connectDb"
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

export default updateUserPassword;