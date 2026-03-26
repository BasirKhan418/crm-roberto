import mongoose from "mongoose";

const NoteSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    title: {
      type: String,
      required: [true, "Note title is required"],
      trim: true,
    },

    description: {
      type: String,
      required: [true, "Note description is required"],
      trim: true,
    },

    linkedType: {
      type: String,
      required: true,
      enum: ["client", "supplier"],
    },

    linkedId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "linkedType",
    },

    followUpDate: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

NoteSchema.index({ user: 1, createdAt: -1 });

NoteSchema.index({ followUpDate: 1 });

NoteSchema.index({ title: "text", description: "text" });

export default mongoose.models.Note ||
  mongoose.model("Note", NoteSchema);