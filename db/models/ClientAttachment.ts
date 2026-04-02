import mongoose from "mongoose";

const ClientAttachmentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      required: true,
      index: true,
    },

    fileName: {
      type: String,
      required: [true, "File name is required"],
      trim: true,
    },

    fileUrl: {
      type: String,
      required: [true, "File URL is required"],
      trim: true,
    },

    fileType: {
      type: String,
      trim: true,
      default: null,
    },

    fileSize: {
      type: Number,
      default: null,
    },

    s3Key: {
      type: String,
      trim: true,
      default: null,
    },
  },
  { timestamps: true }
);

ClientAttachmentSchema.index({ user: 1, clientId: 1, createdAt: -1 });

export default mongoose.models.ClientAttachment ||
  mongoose.model("ClientAttachment", ClientAttachmentSchema);
