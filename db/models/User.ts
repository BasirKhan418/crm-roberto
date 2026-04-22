import mongoose from "mongoose";
const UserSchema = new mongoose.Schema({
    name: { type: String, required: true,trim: true, },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    locale: {
      type: String,
      enum: ['en', 'fr'],
      default: 'fr',
      trim: true,
    },
     password: {
      type: String,
      required: true,
      minlength: [8, 'Password must be at least 8 characters'],
      select: false, 
    },
     isOnboardingComplete: {
      type: Boolean,
      default: false,
    },
    onboardingGuideSeenPages: {
      type: [String],
      default: [],
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    account_status: {
      type: String,
      enum: ['active', 'suspended'],
      default: 'active',
    },
}, { timestamps: true })
export default mongoose.models.User || mongoose.model('User', UserSchema);