import ConnectDb from "../connectDb";
import CompanyProfile from "../models/CompanyProfile";
import { CreateCompanyProfileDTO } from "../../validators/cprofile.schema";
import User from "../models/User";
export const createCompanyProfile = async (data:CreateCompanyProfileDTO) => {
    try{
         await ConnectDb();
        const newProfile = new CompanyProfile(data);
        await newProfile.save();
        await User.findByIdAndUpdate(data.user, { isOnboardingComplete: true });
        return { message: "Company profile created successfully", success: true, profile: newProfile };
    }
    catch(error){
        console.error("Error creating company profile:", error);
        return { message: "Error creating company profile: " + error, success: false };
    }
}