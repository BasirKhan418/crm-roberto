
import ConnectDb from "../connectDb";
import User from "../models/User";
const getUserByEmail = async (email: string) => {
    try{
        await ConnectDb();
        const user = await User.findOne({ email ,isEmailVerified: true });
        if (!user) {
            return { message: "User not found", success: false };
        }
        return { message: "User fetched successfully", success: true, user };
    }
    catch(error){
        return { message: "Error fetching user by email"+error, success: false };
    }
}

export default getUserByEmail;