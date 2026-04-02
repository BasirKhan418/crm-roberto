import mongoose from "mongoose";

const InteractionSchema = new mongoose.Schema(
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

    type: {
      type: String,
      required: true,
      enum: ["call", "meeting", "email", "discussion"],
    },

    title: {
      type: String,
      required: [true, "Interaction title is required"],
      trim: true,
    },

    notes: {
      type: String,
      trim: true,
      default: null,
    },

    date: {
      type: Date,
      required: true,
    },

    followUpDate: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

InteractionSchema.index({ user: 1, clientId: 1, date: -1 });

export default mongoose.models.Interaction ||
  mongoose.model("Interaction", InteractionSchema);
