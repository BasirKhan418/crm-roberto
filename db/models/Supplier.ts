import mongoose from "mongoose";

const SupplierSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    fullName: {
      type: String,
      required: [true, "Supplier name is required"],
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
  },
  { timestamps: true }
);


SupplierSchema.index({
  fullName: "text",
  email: "text",
  phone: "text",
  companyName: "text",
});

SupplierSchema.index({ user: 1, createdAt: -1 });


SupplierSchema.virtual("notes", {
  ref: "Note",
  localField: "_id",
  foreignField: "linkedId",
  match: { linkedType: "supplier" },
});

export default mongoose.models.Supplier ||
  mongoose.model("Supplier", SupplierSchema);