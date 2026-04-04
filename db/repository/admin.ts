import ConnectDb from "../connectDb";
import User from "../models/User";
import mongoose from "mongoose";

interface AdminUserListItem {
  _id: mongoose.Types.ObjectId | string;
  name?: string;
  email?: string;
  account_status?: "active" | "suspended";
  isEmailVerified?: boolean;
  isOnboardingComplete?: boolean;
  createdAt?: Date;
}

export async function getAllUsers() {
  try {
    await ConnectDb();
    const rawUsers = await User.find({})
      .select("name email account_status isEmailVerified isOnboardingComplete createdAt")
      .sort({ createdAt: -1 })
      .lean<AdminUserListItem[]>();
    // Treat missing account_status as 'active' for legacy documents
    const users = rawUsers.map((u) => ({
      ...u,
      account_status: u.account_status ?? 'active',
    }));
    return { success: true, users };
  } catch (error) {
    return { success: false, message: "Error fetching users: " + error, users: [] };
  }
}

export async function updateAccountStatus(
  userId: string,
  account_status: "active" | "suspended"
) {
  try {
    await ConnectDb();
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return { success: false, message: "Invalid user ID" };
    }
    const updateResult = await User.updateOne(
      { _id: userId },
      { $set: { account_status } }
    );
    if (updateResult.matchedCount === 0) {
      return { success: false, message: "User not found" };
    }
    if (updateResult.modifiedCount === 0) {
      return { success: false, message: "Status is already set to that value or update failed" };
    }
    const user = await User.findById(userId)
      .select("name email account_status isEmailVerified isOnboardingComplete createdAt")
      .lean();
    return { success: true, message: "Account status updated", user };
  } catch (error) {
    return { success: false, message: "Error updating account status: " + error };
  }
}
