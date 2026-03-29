import mongoose from "mongoose";
export type QuoteStatus = "draft" | "sent" | "accepted" | "refused";

const LineItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CatalogueItem",
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

    vatRate: {
      type: Number,
      required: [true, "VAT rate is required"],
      min: [0, "VAT rate cannot be negative"],
      max: [100, "VAT rate cannot exceed 100"],
    },

    totalExcludingTax: {
      type: Number,
      required: true,
      min: [0, "Total cannot be negative"],
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
    from:      { type: String, enum: ["draft", "sent", "accepted", "refused"] },
    to:        { type: String, enum: ["draft", "sent", "accepted", "refused"], required: true },
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
        values: ["draft", "sent", "accepted", "refused"],
        message: "Status must be draft, sent, accepted, or refused",
      },
      default: "draft",
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

// ── Indexes ───────────────────────────────────────────────────────────────────

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