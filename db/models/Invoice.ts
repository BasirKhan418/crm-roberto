import mongoose, { type InferSchemaType, type Model } from "mongoose";

export const INVOICE_STATUS = ["unpaid", "partial_paid", "paid", "overdue"] as const;

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

const InvoiceAddressDetailsSchema = new mongoose.Schema(
  {
    streetNumber: { type: String, default: null },
    streetName: { type: String, default: null },
    postalCode: { type: String, default: null },
    city: { type: String, default: null },
    country: { type: String, default: null },
  },
  { _id: false }
);

const InvoiceClientSnapshotSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true },
    email: { type: String, default: null },
    phone: { type: String, default: null },
    address: { type: String, default: null },
    addressDetails: { type: InvoiceAddressDetailsSchema, default: null },
    companyName: { type: String, default: null },
    vatNumber: { type: String, default: null },
  },
  { _id: false }
);

const InvoiceReminderStateSchema = new mongoose.Schema(
  {
    level: {
      type: Number,
      min: 0,
      max: 4,
      default: 0,
    },
    lastSentAt: {
      type: Date,
      default: null,
    },
    nextScheduledAt: {
      type: Date,
      default: null,
    },
    isPaused: {
      type: Boolean,
      default: false,
    },
    lateFeeAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    formalNoticeSentAt: {
      type: Date,
      default: null,
    },
    formalNoticeDeadline: {
      type: Date,
      default: null,
    },
    legalRecoveryInitiatedAt: {
      type: Date,
      default: null,
    },
    legalRecoverySentToCourtAt: {
      type: Date,
      default: null,
    },
    legalRecoveryClaimAmount: {
      type: Number,
      min: 0,
      default: null,
    },
  },
  { _id: false }
);

const InvoiceRecurrenceTemplateSchema = new mongoose.Schema(
  {
    lineItems: {
      type: [InvoiceLineItemSchema],
      default: undefined,
    },
    totalExcludingTax: {
      type: Number,
      min: 0,
      default: null,
    },
    totalVat: {
      type: Number,
      min: 0,
      default: null,
    },
    totalIncludingTax: {
      type: Number,
      min: 0,
      default: null,
    },
    depositPercentage: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },
    notes: {
      type: String,
      trim: true,
      default: null,
      maxlength: 2000,
    },
  },
  { _id: false }
);

const InvoiceRecurrenceSchema = new mongoose.Schema(
  {
    isActive: {
      type: Boolean,
      default: false,
    },
    frequency: {
      type: String,
      enum: ["monthly", "quarterly", "yearly", "custom"],
      default: null,
    },
    customIntervalDays: {
      type: Number,
      min: 1,
      default: null,
    },
    nextOccurrenceAt: {
      type: Date,
      default: null,
    },
    lastGeneratedAt: {
      type: Date,
      default: null,
    },
    lastGeneratedInvoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Invoice",
      default: null,
    },
    endDate: {
      type: Date,
      default: null,
    },
    stoppedAt: {
      type: Date,
      default: null,
    },
    stoppedReason: {
      type: String,
      trim: true,
      default: null,
    },
    autoGenerate: {
      type: Boolean,
      default: false,
    },
    autoSend: {
      type: Boolean,
      default: false,
    },
    template: {
      type: InvoiceRecurrenceTemplateSchema,
      default: null,
    },
  },
  { _id: false }
);

const InvoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
      required: true,
      trim: true,
    },
    quoteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Quote",
      default: null,
      index: true,
    },
    quoteNumber: {
      type: String,
      default: null,
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
        message: "Status must be unpaid, partial_paid, paid, or overdue",
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
    paymentToken: {
      type: String,
      default: null,
      trim: true,
    },
    paymentTokenExpiry: {
      type: Date,
      default: null,
    },
    legalRecoveryCourtLocation: {
      type: String,
      enum: ['luxembourg', 'esch_sur_alzette', 'diekirch', null],
      default: null,
    },
    reminderState: {
      type: InvoiceReminderStateSchema,
      default: null,
    },
    recurrence: {
      type: InvoiceRecurrenceSchema,
      default: null,
    },

    ownerHasUnread: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

InvoiceSchema.pre("validate", function computeDepositAmount() {
  const percent = this.depositPercentage ?? 100;
  const total = this.totalIncludingTax ?? 0;
  this.depositAmount = Math.round(total * (percent / 100));
});

type PreFn = (
  method: string | string[],
  fn: (this: unknown) => void
) => void;
const preInvoiceHook = (InvoiceSchema.pre as unknown as PreFn).bind(InvoiceSchema);

preInvoiceHook("save", function () {
  const doc = this as mongoose.HydratedDocument<InvoiceDocument>;
  if (doc.isNew) return;
  if (doc.isModified("ownerHasUnread")) return;
  const otherModified = doc.modifiedPaths().some((p) => p !== "ownerHasUnread");
  if (otherModified) {
    doc.ownerHasUnread = true;
  }
});

preInvoiceHook(["updateOne", "findOneAndUpdate", "updateMany"], function () {
  const query = this as mongoose.Query<unknown, InvoiceDocument>;
  const update = query.getUpdate() as Record<string, unknown> | null;
  if (!update) {
    return;
  }

  const $set = (update.$set ?? {}) as Record<string, unknown>;
  const hasExplicitFlag =
    "ownerHasUnread" in update || "ownerHasUnread" in $set;

  if (!hasExplicitFlag) {
    update.$set = { ...$set, ownerHasUnread: true };
    query.setUpdate(update);
  }
});

InvoiceSchema.index({ userId: 1, invoiceNumber: 1 }, { unique: true, name: "unique_user_invoice_number" });
InvoiceSchema.index({ userId: 1, createdAt: -1 });
InvoiceSchema.index({ userId: 1, status: 1 });
InvoiceSchema.index({ userId: 1, quoteId: 1 });
InvoiceSchema.index({ "reminderState.nextScheduledAt": 1 }, { sparse: true });
InvoiceSchema.index({ "recurrence.nextOccurrenceAt": 1 }, { sparse: true });
InvoiceSchema.index(
  { paymentToken: 1 },
  {
    unique: true,
    partialFilterExpression: { paymentToken: { $type: "string" } },
    name: "unique_invoice_payment_token",
  }
);

export type InvoiceDocument = InferSchemaType<typeof InvoiceSchema>;

const INVOICE_MODEL_VERSION = 3;

type VersionedInvoiceModel = Model<InvoiceDocument> & { __ownerUnreadVersion?: number };

const existingInvoiceModel = mongoose.models.Invoice as VersionedInvoiceModel | undefined;

if (
  existingInvoiceModel &&
  (!existingInvoiceModel.schema.path("ownerHasUnread") ||
    !existingInvoiceModel.schema.path('legalRecoveryCourtLocation') ||
    existingInvoiceModel.__ownerUnreadVersion !== INVOICE_MODEL_VERSION)
) {
  delete (mongoose.models as Record<string, VersionedInvoiceModel>).Invoice;
}

const InvoiceModel =
  ((mongoose.models.Invoice as VersionedInvoiceModel | undefined) ||
    mongoose.model<InvoiceDocument>("Invoice", InvoiceSchema)) as VersionedInvoiceModel;

InvoiceModel.__ownerUnreadVersion = INVOICE_MODEL_VERSION;

export default InvoiceModel;
