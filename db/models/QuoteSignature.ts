import mongoose, { type InferSchemaType, type Model } from "mongoose";

export interface QuoteSignatureDocument extends InferSchemaType<typeof QuoteSignatureSchema> {}

const QuoteSignatureSchema = new mongoose.Schema(
  {
    quoteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Quote",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    token: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    tokenExpiry: {
      type: Date,
      required: true,
    },
    signatureDataUrl: {
      type: String,
      required: true,
    },
    signedAt: {
      type: Date,
      default: () => new Date(),
    },
    clientIp: {
      type: String,
      default: null,
      trim: true,
    },
    clientUserAgent: {
      type: String,
      default: null,
      trim: true,
    },
    isUsed: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true }
);

QuoteSignatureSchema.index({ token: 1 }, { unique: true, name: "unique_quote_signature_token" });
QuoteSignatureSchema.index({ quoteId: 1, userId: 1, createdAt: -1 });

const QuoteSignatureModel =
  (mongoose.models.QuoteSignature as Model<QuoteSignatureDocument>) ||
  mongoose.model<QuoteSignatureDocument>("QuoteSignature", QuoteSignatureSchema);

export default QuoteSignatureModel;
