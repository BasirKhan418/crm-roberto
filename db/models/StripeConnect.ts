import mongoose, { type InferSchemaType, type Model } from "mongoose";

const StripeConnectSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    stripeAccountId: {
      type: String,
      required: true,
      trim: true,
    },
    chargesEnabled: {
      type: Boolean,
      default: false,
    },
    payoutsEnabled: {
      type: Boolean,
      default: false,
    },
    onboardingComplete: {
      type: Boolean,
      default: false,
    },
    connectedAt: {
      type: Date,
      default: () => new Date(),
    },
  },
  { timestamps: true }
);

StripeConnectSchema.index({ userId: 1 }, { unique: true, name: "unique_stripe_connect_user" });
StripeConnectSchema.index({ stripeAccountId: 1 }, { unique: true, name: "unique_stripe_account_id" });

export type StripeConnectDocument = InferSchemaType<typeof StripeConnectSchema>;

const StripeConnectModel =
  (mongoose.models.StripeConnect as Model<StripeConnectDocument>) ||
  mongoose.model<StripeConnectDocument>("StripeConnect", StripeConnectSchema);

export default StripeConnectModel;
