import mongoose from "mongoose";

const ActivityLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    action: {
      type: String,
      required: true,
      enum: [
        "client_created",
        "client_updated",
        "client_deleted",
        "supplier_created",
        "supplier_updated",
        "supplier_deleted",
        "note_created",
        "note_updated",
        "note_deleted",
        "product_created",
        "product_updated",
        "product_deleted",
        "quote_created",
        "quote_updated",
        "quote_deleted",
        "quote_sent",
        "quote_client_replied",
        "quote_status_changed", 
        "quote_duplicated",
        "invoice_created",
        "invoice_payment_received",
        "invoice_payment_updated",
        "invoice_payment_deleted",
        "invoice_reminder_sent",
        "invoice_reminder_paused",
        "invoice_reminder_resumed",
        "invoice_formal_notice_sent",
        "invoice_recurrence_created",
        "invoice_recurrence_stopped",
        "invoice_recurrence_generated",
        "invoice_recurrence_due",
      ],
    },

    entityType: {
      type: String,
      enum: ["client", "supplier", "note", "product", "quote", "invoice", "reminder", "recurrence"],
      required: true,
    },

    entityName: {
      type: String,
      required: true,
    },

    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
     metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);


ActivityLogSchema.index({ user: 1, createdAt: -1 });
ActivityLogSchema.index({ user: 1, isRead: 1, createdAt: -1 });

export default mongoose.models.ActivityLog ||
  mongoose.model("ActivityLog", ActivityLogSchema);