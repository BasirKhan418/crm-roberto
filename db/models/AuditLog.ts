import mongoose from "mongoose";

const AuditLogSchema = new mongoose.Schema(
  {
    entityType: {
      type: String,
      enum: ["expense", "invoice", "supplier", "user", "ticket", "report"],
      required: true,
      index: true,
    },
    entityId: {
      type: String,
      required: true,
      index: true,
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    action: {
      type: String,
      enum: [
        "created",
        "updated",
        "deleted",
        "archived",
        "duplicated",
        "status_changed",
        "marked_paid",
        "payment_added",
        "exported",
        "downloaded",
      ],
      required: true,
      index: true,
    },
    fieldName: {
      type: String,
      default: null,
      trim: true,
    },
    oldValue: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    newValue: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    performedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    ipAddress: {
      type: String,
      default: null,
      trim: true,
    },
    source: {
      type: String,
      enum: ["ui", "api", "system"],
      default: "api",
    },
  },
  {
    timestamps: {
      createdAt: true,
      updatedAt: false,
    },
  }
);

AuditLogSchema.index({ companyId: 1, entityType: 1, entityId: 1, performedAt: -1 });
AuditLogSchema.index({ companyId: 1, action: 1, performedAt: -1 });

export default mongoose.models.AuditLog || mongoose.model("AuditLog", AuditLogSchema);
