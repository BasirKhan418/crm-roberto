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

export const getCompanyProfileByUserId = async (userId: string) => {
    try {
        await ConnectDb();
        const profile = await CompanyProfile.findOne({ user: userId }).lean();
        if (!profile) {
            return { message: "Company profile not found", success: false };
        }
        return { message: "Company profile fetched successfully", success: true, profile };
    }
    catch (error) {
        console.error("Error fetching company profile:", error);
        return { message: "Error fetching company profile: " + error, success: false };
    }
}

export const updateCompanyProfileByUserId = async (userId: string, data: Partial<CreateCompanyProfileDTO>) => {
    try {
        await ConnectDb();
        const profile = await CompanyProfile.findOneAndUpdate(
            { user: userId },
            data,
            { new: true, runValidators: true }
        ).lean();

        if (!profile) {
            return { message: "Company profile not found", success: false };
        }

        return { message: "Company profile updated successfully", success: true, profile };
    }
    catch (error) {
        console.error("Error updating company profile:", error);
        return { message: "Error updating company profile: " + error, success: false };
    }
}