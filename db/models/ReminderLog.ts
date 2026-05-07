import mongoose, { type InferSchemaType } from "mongoose";

const ReminderLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    invoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Invoice",
      required: true,
      index: true,
    },
    level: {
      type: Number,
      enum: [1, 2, 3, 4],
      required: true,
    },
    channel: {
      type: String,
      enum: ["email", "whatsapp"],
      default: "email",
    },
    status: {
      type: String,
      enum: ["sent", "failed", "skipped", "paused", "resumed"],
      required: true,
    },
    skippedReason: {
      type: String,
      default: null,
      trim: true,
    },
    subject: {
      type: String,
      default: "",
      trim: true,
    },
    bodyPreview: {
      type: String,
      default: "",
      trim: true,
      maxlength: 280,
    },
    recipientEmail: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
    },
    lateFeeAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    error: {
      type: String,
      default: null,
      trim: true,
    },
    sentAt: {
      type: Date,
      required: true,
    },
    pdfAttached: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

ReminderLogSchema.index({ userId: 1, invoiceId: 1, sentAt: -1 });

export type IReminderLog = InferSchemaType<typeof ReminderLogSchema>;

export default mongoose.models.ReminderLog || mongoose.model("ReminderLog", ReminderLogSchema);
