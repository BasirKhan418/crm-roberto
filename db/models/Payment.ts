import mongoose, { type InferSchemaType, type Model } from "mongoose";

export const PAYMENT_TYPE = ["deposit", "full", "remaining_balance"] as const;
export const PAYMENT_STATUS = ["pending", "succeeded", "failed"] as const;
export const PAYMENT_SOURCE = ["stripe", "manual"] as const;

const PaymentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    invoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Invoice",
      required: true,
      index: true,
    },
    stripePaymentId: {
      type: String,
      required: true,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [0, "Amount cannot be negative"],
    },
    currency: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      default: "eur",
    },
    type: {
      type: String,
      required: true,
      enum: {
        values: PAYMENT_TYPE,
        message: "Type must be deposit, full, or remaining_balance",
      },
      default: "full",
    },
    status: {
      type: String,
      required: true,
      enum: {
        values: PAYMENT_STATUS,
        message: "Status must be pending, succeeded, or failed",
      },
      default: "pending",
    },
    method: {
      type: String,
      required: true,
      trim: true,
    },
    source: {
      type: String,
      required: true,
      enum: {
        values: PAYMENT_SOURCE,
        message: "Source must be stripe or manual",
      },
      default: "stripe",
      index: true,
    },
    paidAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

PaymentSchema.index({ invoiceId: 1 }, { name: "payment_invoice_lookup" });
PaymentSchema.index({ stripePaymentId: 1 }, { unique: true, name: "unique_stripe_payment_id" });
PaymentSchema.index({ userId: 1, createdAt: -1 });

export type PaymentDocument = InferSchemaType<typeof PaymentSchema>;

const PaymentModel =
  (mongoose.models.Payment as Model<PaymentDocument>) ||
  mongoose.model<PaymentDocument>("Payment", PaymentSchema);

export default PaymentModel;
