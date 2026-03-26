
import ConnectDb from "../connectDb";
import User from "../models/User";
const registerUser = async (name: string, email: string, password: string) => {
    try{
        await ConnectDb();
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return { message: "User with this email already exists" ,success : false};
        }
        const newUser = new User({ name, email, password });
        await newUser.save();
        return { message: "User registered successfully", success: true };
    }
    catch(error){
        return { message: "Error registering user"+error, success: false };
    }
};


const loginUser = async (email: string, password: string) => {
    try{
        await ConnectDb();
        const user = await User.findOne({ email }).select("+password");
        if (!user) {
            return { message: "User not found", success: false };
        }
        if (user.password !== password) {
            return { message: "Invalid password", success: false };
        }
        return { message: "Login successful", success: true, user };
    }
    catch(error){
        return { message: "Error logging in user"+error, success: false };
    }
};

export { registerUser, loginUser };