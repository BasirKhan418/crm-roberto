import mongoose from "mongoose";

const RoleMatrixPermissionSchema = new mongoose.Schema(
  {
    canView: { type: Boolean, default: false },
    canCreate: { type: Boolean, default: false },
    canEdit: { type: Boolean, default: false },
    canDelete: { type: Boolean, default: false },
    canExport: { type: Boolean, default: false },
    canManage: { type: Boolean, default: false },
  },
  { _id: false }
);

const RoleMatrixSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    role: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    moduleKey: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    permissions: {
      type: RoleMatrixPermissionSchema,
      default: () => ({
        canView: false,
        canCreate: false,
        canEdit: false,
        canDelete: false,
        canExport: false,
        canManage: false,
      }),
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

RoleMatrixSchema.index({ companyId: 1, role: 1, moduleKey: 1 }, { unique: true });

export default mongoose.models.RoleMatrix || mongoose.model("RoleMatrix", RoleMatrixSchema);