import mongoose from "mongoose";

const CompanyFeatureFlagsSchema = new mongoose.Schema(
  {
    expenses: { type: Boolean, default: true },
    tickets: { type: Boolean, default: true },
    financialDashboard: { type: Boolean, default: true },
    accountantPortal: { type: Boolean, default: true },
    exports: { type: Boolean, default: true },
    advancedRoles: { type: Boolean, default: false },
  },
  { _id: false }
);

const CompanySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 140,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["active", "suspended"],
      default: "active",
      index: true,
    },
    ownerUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    featureFlags: {
      type: CompanyFeatureFlagsSchema,
      default: () => ({
        expenses: true,
        tickets: true,
        financialDashboard: true,
        accountantPortal: true,
        exports: true,
        advancedRoles: false,
      }),
    },
    suspendedAt: {
      type: Date,
      default: null,
    },
    deletedAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  { timestamps: true }
);

CompanySchema.index({ ownerUserId: 1, status: 1 });
CompanySchema.index({ createdAt: -1 });

export default mongoose.models.Company || mongoose.model("Company", CompanySchema);