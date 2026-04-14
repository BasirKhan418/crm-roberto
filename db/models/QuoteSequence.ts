import mongoose from "mongoose";

const QuoteSequenceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    year: {
      type: Number,
      required: true,
      min: 2000,
      max: 9999,
    },
    lastCounter: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

QuoteSequenceSchema.index(
  { user: 1, year: 1 },
  { unique: true, name: "unique_user_quote_sequence_by_year" }
);

export default mongoose.models.QuoteSequence ||
  mongoose.model("QuoteSequence", QuoteSequenceSchema);
