import mongoose from "mongoose";

export type CatalogueItemType = "product" | "service";

const CatalogueItemSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: [true, "Item name is required"],
      trim: true,
      maxlength: [200, "Name cannot exceed 200 characters"],
    },
    priceExcludingTax: {
      type: Number,
      required: [true, "Price is required"],
      min: [0, "Price cannot be negative"],
    },
    vatRate: {
      type: Number,
      required: [true, "VAT rate is required"],
      default: 17,
      min: [0, "VAT rate cannot be negative"],
      max: [100, "VAT rate cannot exceed 100"],
    },
    type: {
      type: String,
      required: [true, "Item type is required"],
      enum: {
        values: ["product", "service"],
        message: "Type must be either 'product' or 'service'",
      },
    },
    description: {
      type: String,
      trim: true,
      default: null,
      maxlength: [1000, "Description cannot exceed 1000 characters"],
    },
  },
  { timestamps: true }
);
CatalogueItemSchema.index({ user: 1, createdAt: -1 });

CatalogueItemSchema.index({ user: 1, type: 1 });

CatalogueItemSchema.index(
  { name: "text", description: "text" },
  { name: "catalogue_search_index" }
);

export default mongoose.models.Catalogue ||
  mongoose.model("Catalogue", CatalogueItemSchema);