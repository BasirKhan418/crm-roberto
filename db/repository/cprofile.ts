import ConnectDb from "../connectDb";
import CompanyProfile from "../models/CompanyProfile";
import { CreateCompanyProfileDTO, UpdateCompanyProfileDTO } from "../../validators/cprofile.schema";
import User from "../models/User";

function formatCompanyAddress(data: {
  streetNumber?: string | null;
  streetName?: string | null;
  postalCode?: string | null;
  city?: string | null;
  country?: string | null;
}): string | null {
  const streetParts = [data.streetNumber, data.streetName].map((p) => (p ?? '').trim()).filter(Boolean);
  const line1 = streetParts.join(' ');
  const line2Parts = [data.postalCode, data.city].map((p) => (p ?? '').trim()).filter(Boolean);
  const line2 = line2Parts.join(' ');
  const country = (data.country ?? '').trim();
  const combined = [line1, line2, country].filter(Boolean).join(', ');
  return combined || null;
}

export const createCompanyProfile = async (data: CreateCompanyProfileDTO) => {
    try{
         await ConnectDb();
        const address = formatCompanyAddress(data);
        const newProfile = new CompanyProfile({ ...data, ...(address !== null ? { address } : {}) });
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

export const updateCompanyProfileByUserId = async (userId: string, data: UpdateCompanyProfileDTO) => {
    try {
        await ConnectDb();
        const hasAddressField = 'streetNumber' in data || 'streetName' in data || 'postalCode' in data || 'city' in data || 'country' in data;
        const updateData = hasAddressField
          ? { ...data, address: formatCompanyAddress(data) }
          : data;
        const profile = await CompanyProfile.findOneAndUpdate(
            { user: userId },
            updateData,
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

export const updateCompanyLogoByUserId = async (
  userId: string,
  logoUrl: string | null,
  logoKey: string | null
) => {
  try {
    await ConnectDb();
    const profile = await CompanyProfile.findOneAndUpdate(
      { user: userId },
      { logoUrl, logoKey },
      { new: true }
    ).lean();

    if (!profile) {
      return { message: 'Company profile not found', success: false };
    }

    return { message: 'Logo updated successfully', success: true, profile };
  } catch (error) {
    console.error('Error updating company logo:', error);
    return { message: 'Error updating company logo: ' + error, success: false };
  }
}