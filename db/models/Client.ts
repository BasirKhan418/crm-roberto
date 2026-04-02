import mongoose from "mongoose";

const AddressDetailsSchema = new mongoose.Schema(
  {
    street: { type: String, trim: true, default: null },
    postalCode: { type: String, trim: true, default: null },
    city: { type: String, trim: true, default: null },
    country: { type: String, trim: true, default: null },
  },
  { _id: false }
);

const ClientSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    clientType: {
      type: String,
      enum: ["company", "individual"],
      default: "company",
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

    addressDetails: {
      type: AddressDetailsSchema,
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

    rcsNumber: {
      type: String,
      trim: true,
      default: null,
    },

    businessAuthorizationNumber: {
      type: String,
      trim: true,
      default: null,
    },

    matriculeNumber: {
      type: String,
      trim: true,
      default: null,
    },

    title: {
      type: String,
      trim: true,
      default: null,
    },

    firstName: {
      type: String,
      trim: true,
      default: null,
    },

    lastName: {
      type: String,
      trim: true,
      default: null,
    },

    bankName: {
      type: String,
      trim: true,
      default: null,
    },

    iban: {
      type: String,
      trim: true,
      default: null,
    },

    responsibleEmail: {
      type: String,
      lowercase: true,
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

    companyPhone: {
      type: String,
      trim: true,
      default: null,
    },

    privatePhone: {
      type: String,
      trim: true,
      default: null,
    },

    mobilePhone: {
      type: String,
      trim: true,
      default: null,
    },

    additionalDescription: {
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
  firstName: "text",
  lastName: "text",
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