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

    contactName: {
      type: String,
      trim: true,
      default: null,
    },

    category: {
      type: String,
      enum: {
        values: ["materials", "logistics", "services", "technology", "other"],
        message: "Invalid supplier category",
      },
      default: "other",
      index: true,
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

    streetNumber: {
      type: String,
      trim: true,
      default: null,
    },

    address: {
      type: String,
      trim: true,
      default: null,
    },

    postalCode: {
      type: String,
      trim: true,
      default: null,
    },

    city: {
      type: String,
      trim: true,
      default: null,
    },

    country: {
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

    iban: {
      type: String,
      trim: true,
      default: null,
    },

    notes: {
      type: String,
      trim: true,
      default: null,
    },

    tags: {
      type: [String],
      enum: {
        values: ['important', 'pending', 'partner'],
        message: 'Invalid supplier tag',
      },
      default: [],
    },
  },
  { timestamps: true }
);


SupplierSchema.index({
  fullName: "text",
  contactName: "text",
  email: "text",
  phone: "text",
  companyName: "text",
  city: "text",
  country: "text",
});

SupplierSchema.index({ user: 1, createdAt: -1 });
SupplierSchema.index({ user: 1, category: 1, createdAt: -1 });
SupplierSchema.index({ user: 1, tags: 1, createdAt: -1 });


SupplierSchema.virtual("timelineNotes", {
  ref: "Note",
  localField: "_id",
  foreignField: "linkedId",
  match: { linkedType: "supplier" },
});

export default mongoose.models.Supplier ||
  mongoose.model("Supplier", SupplierSchema);