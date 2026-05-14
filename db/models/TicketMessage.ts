import mongoose from "mongoose";

const TicketMessageSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    ticketId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ticket",
      required: true,
      index: true,
    },
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    body: {
      type: String,
      default: "",
      trim: true,
      maxlength: 10000,
    },
    attachmentIds: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "TicketAttachment",
        },
      ],
      default: [],
    },
  },
  {
    timestamps: {
      createdAt: true,
      updatedAt: false,
    },
  }
);

TicketMessageSchema.index({ companyId: 1, ticketId: 1, createdAt: 1 });
TicketMessageSchema.index({ ticketId: 1, createdAt: 1 });

export default
  mongoose.models.TicketMessage || mongoose.model("TicketMessage", TicketMessageSchema);
