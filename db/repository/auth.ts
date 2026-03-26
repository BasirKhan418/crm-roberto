
import ConnectDb from "../connectDb";
import argon2 from "argon2";
import User from "../models/User";
const registerUser = async (name: string, email: string, password: string) => {
    try{
        await ConnectDb();
        const existingUser = await User.findOne({ email });
        if (existingUser && existingUser.isEmailVerified === false) {
            return { message: "User with this email already exists verify otp and complete registration", success: true};
        }
        if (existingUser && existingUser.isEmailVerified === true) {
            return { message: "User with this email already exists . Please Login to continue !", success: false };
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
    try {
        await ConnectDb();
        const user = await User.findOne({ email,isEmailVerified: true }).select("+password");
        console.log("User found:", user);
        if (!user) {
            return { message: "User not found", success: false };
        }

        const pepper = process.env.PASSWORD_PEPPER;

        const isValid = await argon2.verify(
            user.password,           // stored hash
            password + pepper        // raw input + pepper
        );

        if (!isValid) {
            return { message: "Invalid password", success: false };
        }

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
        await user.save();
        return { message: "Email marked as verified", success: true };
    } catch (error) {
        return { message: "Error marking email as verified" + error, success: false };
    }
}



export { registerUser, loginUser, markEmailAsVerified };