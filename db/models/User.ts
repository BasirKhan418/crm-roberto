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
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      index: true,
      default: null,
    },
    role: {
      type: String,
      enum: [
        'super_admin',
        'administrator',
        'manager',
        'standard_user',
        'secretary',
        'technician',
        'read_only',
        'external_accountant',
      ],
      default: 'standard_user',
      index: true,
    },
    invitationStatus: {
      type: String,
      enum: ['none', 'pending', 'accepted', 'revoked', 'expired'],
      default: 'none',
      index: true,
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    invitationTokenHash: {
      type: String,
      default: null,
      select: false,
    },
    invitationExpiresAt: {
      type: Date,
      default: null,
    },
    accessRevokedAt: {
      type: Date,
      default: null,
      index: true,
    },
    forceLogoutAfter: {
      type: Date,
      default: null,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
    failedLoginCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lockedUntil: {
      type: Date,
      default: null,
    },
}, { timestamps: true })
UserSchema.index({ companyId: 1, role: 1 });
export default mongoose.models.User || mongoose.model('User', UserSchema);