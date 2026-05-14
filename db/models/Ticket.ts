import mongoose from "mongoose";

import { TICKET_LINKED_TYPES, TICKET_STATUSES, TICKET_TYPES } from "@/lib/tickets/constants";

const TicketSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180,
    },
    type: {
      type: String,
      enum: TICKET_TYPES,
      required: true,
      default: "document",
      index: true,
    },
    status: {
      type: String,
      enum: TICKET_STATUSES,
      required: true,
      default: "open",
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    assignedTo: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      ],
      default: [],
      index: true,
    },
    linkedType: {
      type: String,
      enum: TICKET_LINKED_TYPES,
      default: null,
      index: true,
    },
    linkedId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    unreadBy: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      ],
      default: [],
      index: true,
    },
    resolvedAt: {
      type: Date,
      default: null,
      index: true,
    },
    archivedAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  { timestamps: true }
);

TicketSchema.index({ companyId: 1, status: 1, updatedAt: -1 });
TicketSchema.index({ companyId: 1, assignedTo: 1, status: 1, updatedAt: -1 });
TicketSchema.index({ companyId: 1, linkedType: 1, linkedId: 1, updatedAt: -1 });

export default mongoose.models.Ticket || mongoose.model("Ticket", TicketSchema);
