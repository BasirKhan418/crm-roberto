import mongoose from "mongoose";

const ActivityLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    action: {
      type: String,
      required: true,
      enum: [
        "client_created",
        "client_updated",
        "client_deleted",
        "supplier_created",
        "supplier_updated",
        "supplier_deleted",
        "note_created",
        "note_updated",
        "note_deleted",
      ],
    },

    entityType: {
      type: String,
      enum: ["client", "supplier", "note"],
      required: true,
    },

    entityName: {
      type: String,
      required: true,
    },

    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
  },
  { timestamps: true }
);


ActivityLogSchema.index({ user: 1, createdAt: -1 });

export default mongoose.models.ActivityLog ||
  mongoose.model("ActivityLog", ActivityLogSchema);