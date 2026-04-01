import mongoose, { type InferSchemaType, type Model } from "mongoose";

export const INVOICE_STATUS = ["unpaid", "deposit_paid", "paid", "overdue"] as const;

const InvoiceLineItemSchema = new mongoose.Schema(
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

const InvoiceClientSnapshotSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true },
    email: { type: String, default: null },
    phone: { type: String, default: null },
    address: { type: String, default: null },
    companyName: { type: String, default: null },
    vatNumber: { type: String, default: null },
  },
  { _id: false }
);

const InvoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    quoteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Quote",
      required: true,
      index: true,
    },
    quoteNumber: {
      type: String,
      required: true,
      trim: true,
    },
    date: {
      type: Date,
      required: true,
      default: () => new Date(),
    },
    dueDate: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      required: true,
      enum: {
        values: INVOICE_STATUS,
        message: "Status must be unpaid, deposit_paid, paid, or overdue",
      },
      default: "unpaid",
    },
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      required: true,
      index: true,
    },
    clientSnapshot: {
      type: InvoiceClientSnapshotSchema,
      required: true,
    },
    lineItems: {
      type: [InvoiceLineItemSchema],
      required: true,
      validate: {
        validator: (items: unknown[]) => items.length > 0,
        message: "An invoice must have at least one line item",
      },
    },
    totalExcludingTax: {
      type: Number,
      required: true,
      min: 0,
    },
    totalVat: {
      type: Number,
      required: true,
      min: 0,
    },
    totalIncludingTax: {
      type: Number,
      required: true,
      min: 0,
    },
    depositPercentage: {
      type: Number,
      default: 100,
      min: [0, "Deposit percentage cannot be negative"],
      max: [100, "Deposit percentage cannot exceed 100"],
    },
    depositAmount: {
      type: Number,
      default: 0,
      min: [0, "Deposit amount cannot be negative"],
    },
    notes: {
      type: String,
      trim: true,
      default: null,
      maxlength: [2000, "Notes cannot exceed 2000 characters"],
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    stripePaymentLinkId: {
      type: String,
      default: null,
      trim: true,
    },
    stripeDepositLinkId: {
      type: String,
      default: null,
      trim: true,
    },
  },
  { timestamps: true }
);

InvoiceSchema.pre("validate", function computeDepositAmount() {
  const percent = this.depositPercentage ?? 100;
  const total = this.totalIncludingTax ?? 0;
  this.depositAmount = Math.round(total * (percent / 100));
});

InvoiceSchema.index({ invoiceNumber: 1 }, { unique: true, name: "unique_invoice_number" });
InvoiceSchema.index({ userId: 1, createdAt: -1 });
InvoiceSchema.index({ userId: 1, status: 1 });
InvoiceSchema.index({ userId: 1, quoteId: 1 });

export type InvoiceDocument = InferSchemaType<typeof InvoiceSchema>;

const InvoiceModel =
  (mongoose.models.Invoice as Model<InvoiceDocument>) ||
  mongoose.model<InvoiceDocument>("Invoice", InvoiceSchema);

export default InvoiceModel;
