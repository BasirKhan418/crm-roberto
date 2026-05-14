import mongoose from "mongoose";

import {
  EXPENSE_PAYMENT_METHODS,
  EXPENSE_PAYMENT_STATUS,
  EXPENSE_STATUS,
  EXPENSE_TYPES,
} from "@/lib/expenses/constants";

const ExpenseSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: EXPENSE_STATUS,
      default: "draft",
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: EXPENSE_PAYMENT_STATUS,
      default: "unpaid",
      index: true,
    },
    amountExclVatCents: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    vatRate: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      default: 0,
    },
    vatAmountCents: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    amountInclVatCents: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    expenseDate: {
      type: Date,
      default: null,
      index: true,
    },
    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supplier",
      default: null,
      index: true,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ExpenseCategory",
      default: null,
      index: true,
    },
    paymentMethod: {
      type: String,
      enum: EXPENSE_PAYMENT_METHODS,
      default: null,
    },
    amountPaidCents: {
      type: Number,
      min: 0,
      default: 0,
    },
    paidAt: {
      type: Date,
      default: null,
    },
    dueDate: {
      type: Date,
      default: null,
    },
    supplierRef: {
      type: String,
      default: null,
      trim: true,
    },
    expenseType: {
      type: String,
      enum: EXPENSE_TYPES,
      default: "business",
    },
    notes: {
      type: String,
      default: null,
      trim: true,
    },
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      default: null,
    },
    projectId: {
      type: String,
      default: null,
      trim: true,
    },
    invoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Invoice",
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    archivedAt: {
      type: Date,
      default: null,
    },
    deletedAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  { timestamps: true }
);

ExpenseSchema.index({ companyId: 1, expenseDate: -1 });
ExpenseSchema.index({ companyId: 1, status: 1, createdAt: -1 });
ExpenseSchema.index({ companyId: 1, supplierId: 1, expenseDate: -1 });
ExpenseSchema.index({ companyId: 1, categoryId: 1, expenseDate: -1 });
ExpenseSchema.index({ companyId: 1, paymentStatus: 1, expenseDate: -1 });

export default mongoose.models.Expense || mongoose.model("Expense", ExpenseSchema);
