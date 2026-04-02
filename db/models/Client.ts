import mongoose from "mongoose";

const ClientSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    fullName: {
      type: String,
      required: [true, "Client name is required"],
      trim: true,
    },

    email: {
      type: String,
      lowercase: true,
      trim: true,
      default: null,
    },

    phone: {
      type: String,
      trim: true,
      default: null,
    },

    address: {
      type: String,
      trim: true,
      default: null,
    },

    companyName: {
      type: String,
      trim: true,
      default: null,
    },

    vatNumber: {
      type: String,
      trim: true,
      default: null,
    },

    billingEmail: {
      type: String,
      lowercase: true,
      trim: true,
      default: null,
    },

    billingAddress: {
      type: String,
      trim: true,
      default: null,
    },
  },
  { timestamps: true }
);

ClientSchema.index({
  fullName: "text",
  email: "text",
  phone: "text",
  companyName: "text",
});

ClientSchema.index({ user: 1, createdAt: -1 });


ClientSchema.virtual("notes", {
  ref: "Note",
  localField: "_id",
  foreignField: "linkedId",
  match: { linkedType: "client" },
});

export default mongoose.models.Client ||
  mongoose.model("Client", ClientSchema);