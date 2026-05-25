import mongoose from "mongoose";

const CONNECTION_LOG_EVENT_TYPES = [
  "login_success",
  "login_failed",
  "logout",
  "portal_login_success",
  "portal_login_failed",
  "force_logout",
] as const;

const ConnectionLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      default: null,
      index: true,
    },
    role: {
      type: String,
      default: null,
      trim: true,
    },
    eventType: {
      type: String,
      enum: CONNECTION_LOG_EVENT_TYPES,
      required: true,
      index: true,
    },
    ipAddress: {
      type: String,
      default: null,
      trim: true,
    },
    userAgent: {
      type: String,
      default: null,
      trim: true,
    },
    deviceLabel: {
      type: String,
      default: null,
      trim: true,
    },
  },
  { timestamps: true }
);

ConnectionLogSchema.index({ companyId: 1, createdAt: -1 });
ConnectionLogSchema.index({ userId: 1, createdAt: -1 });
ConnectionLogSchema.index({ eventType: 1, createdAt: -1 });

export default mongoose.models.ConnectionLog || mongoose.model("ConnectionLog", ConnectionLogSchema);