import mongoose from "mongoose";
export type QuoteStatus = "draft" | "sent" | "accepted" | "refused" | "rejected";
export type QuoteSignedStatus = "not_signed" | "signed";

const LineItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CatalogueItem",
      default: null,
    },

    productImageUrl: {
      type: String,
      trim: true,
      default: null,
    },

    name: {
      type: String,
      required: [true, "Line item name is required"],
      trim: true,
    },

    quantity: {
      type: Number,
      required: [true, "Quantity is required"],
      min: [1, "Quantity must be at least 1"],
      default: 1,
    },

    unitPriceExcludingTax: {
      type: Number,
      required: [true, "Unit price is required"],
      min: [0, "Price cannot be negative"],
    },

    baseUnitPriceExcludingTax: {
      type: Number,
      required: [true, "Base unit price is required"],
      min: [0, "Base price cannot be negative"],
    },

    discountPercentage: {
      type: Number,
      required: [true, "Discount percentage is required"],
      min: [0, "Discount cannot be negative"],
      max: [100, "Discount cannot exceed 100"],
      default: 0,
    },

    vatRate: {
      type: Number,
      required: [true, "VAT rate is required"],
      min: [0, "VAT rate cannot be negative"],
      max: [100, "VAT rate cannot exceed 100"],
    },

    totalExcludingTaxBeforeDiscount: {
      type: Number,
      min: [0, "Total before discount cannot be negative"],
      default: 0,
    },

    discountAmountExcludingTax: {
      type: Number,
      min: [0, "Discount amount cannot be negative"],
      default: 0,
    },

    totalExcludingTax: {
      type: Number,
      required: true,
      min: [0, "Total cannot be negative"],
    },

    vatAmount: {
      type: Number,
      min: [0, "VAT amount cannot be negative"],
      default: 0,
    },

    totalIncludingTax: {
      type: Number,
      min: [0, "Total including tax cannot be negative"],
      default: 0,
    },
  },
  { _id: true } 
);

const ClientSnapshotSchema = new mongoose.Schema(
  {
    fullName:    { type: String, required: true },
    email:       { type: String, default: null },
    phone:       { type: String, default: null },
    address:     { type: String, default: null },
    companyName: { type: String, default: null },
    vatNumber:   { type: String, default: null },
  },
  { _id: false } 
);


const StatusHistorySchema = new mongoose.Schema(
  {
    from:      { type: String, enum: ["draft", "sent", "accepted", "refused", "rejected"] },
    to:        { type: String, enum: ["draft", "sent", "accepted", "refused", "rejected"], required: true },
    changedAt: { type: Date, default: () => new Date() },
  },
  { _id: false }
);


const QuoteSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    quoteNumber: {
      type: String,
      required: true,
      trim: true,
      // example: "DEV-001"
    },

    date: {
      type: Date,
      required: true,
      default: () => new Date(),
    },
    status: {
      type: String,
      required: true,
      enum: {
        values: ["draft", "sent", "accepted", "refused", "rejected"],
        message: "Status must be draft, sent, accepted, refused, or rejected",
      },
      default: "draft",
    },

    signedStatus: {
      type: String,
      required: true,
      enum: {
        values: ["not_signed", "signed"],
        message: "Signed status must be not_signed or signed",
      },
      default: "not_signed",
    },

    statusHistory: {
      type: [StatusHistorySchema],
      default: [],
    },
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      required: true,
    },

    clientSnapshot: {
      type: ClientSnapshotSchema,
      required: true,
    },

    lineItems: {
      type: [LineItemSchema],
      required: true,
      validate: {
        validator: (items: unknown[]) => items.length > 0,
        message: "A quote must have at least one line item",
      },
    },

    // ── Calculated totals (stored for PDF speed + accounting integrity) ───────

    // Sum of all lineItem.totalExcludingTax
    totalExcludingTax: {
      type: Number,
      required: true,
      min: 0,
    },

    totalExcludingTaxBeforeDiscount: {
      type: Number,
      min: 0,
      default: 0,
    },

    totalDiscountExcludingTax: {
      type: Number,
      min: 0,
      default: 0,
    },

    // Sum of VAT per line (each line can have a different VAT rate)
    totalVat: {
      type: Number,
      required: true,
      min: 0,
    },

    // totalExcludingTax + totalVat
    totalIncludingTax: {
      type: Number,
      required: true,
      min: 0,
    },

    // ── Optional fields ───────────────────────────────────────────────────────

    // Optional comment left by the client when they reject the quote
    rejectionComment: {
      type: String,
      trim: true,
      default: null,
      maxlength: [1000, "Rejection comment cannot exceed 1000 characters"],
    },

    // Free text shown at bottom of quote
    notes: {
      type: String,
      trim: true,
      default: null,
      maxlength: [2000, "Notes cannot exceed 2000 characters"],
    },

    // Dedicated payment terms field (e.g. "Paiement à 30 jours")
    paymentTerms: {
      type: String,
      trim: true,
      default: null,
      maxlength: [500, "Payment terms cannot exceed 500 characters"],
    },

    // Validity period in days (default 30)
    validityDays: {
      type: Number,
      default: 30,
      min: [1, "Validity must be at least 1 day"],
    },

    // Short subject label for quick identification (e.g. "Website", "Logo")
    subject: {
      type: String,
      trim: true,
      default: null,
      maxlength: [200, "Subject cannot exceed 200 characters"],
    },

    signatureToken: {
      type: String,
      default: null,
      index: true,
    },

    signatureTokenExpiry: {
      type: Date,
      default: null,
    },

    signedAt: {
      type: Date,
      default: null,
    },

    convertedToInvoice: {
      type: Boolean,
      default: false,
    },

    invoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      // Will reference the Invoice model in Phase 3
    },
    quotepdfUrl: {
      type: String,
      default: null,
    },
    invoicepdfUrl: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);



// Speed up list page: all quotes for this user, newest first
QuoteSchema.index({ user: 1, createdAt: -1 });

// Guarantee quote number uniqueness per user.
QuoteSchema.index({ user: 1, quoteNumber: 1 }, { unique: true, name: 'unique_user_quote_number' });

// Speed up status filter tabs
QuoteSchema.index({ user: 1, status: 1 });

// Speed up Dashboard "quotes this month" stat
QuoteSchema.index({ user: 1, date: -1 });

// Speed up search by quote number or client name
QuoteSchema.index(
  { quoteNumber: "text", "clientSnapshot.fullName": "text" },
  { name: "quote_search_index" }
);

export default mongoose.models.Quote ||
  mongoose.model("Quote", QuoteSchema);