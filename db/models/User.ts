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
}, { timestamps: true })
export default mongoose.models.User || mongoose.model('User', UserSchema);