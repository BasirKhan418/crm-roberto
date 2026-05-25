import mongoose from "mongoose";

import { EXPENSE_PAID_BY, EXPENSE_PAYMENT_METHODS } from "@/lib/expenses/constants";

const EXPENSE_PAYMENT_SOURCES = [
  "manual_create",
  "add_payment",
  "settle_expense",
  "legacy_migration",
] as const;

const ExpensePaymentLineSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    expenseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Expense",
      required: true,
      index: true,
    },
    amountPaidCents: {
      type: Number,
      required: true,
      min: 1,
    },
    paidAt: {
      type: Date,
      required: true,
      index: true,
    },
    paymentMethod: {
      type: String,
      enum: EXPENSE_PAYMENT_METHODS,
      default: null,
    },
    paidBy: {
      type: String,
      enum: EXPENSE_PAID_BY,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    source: {
      type: String,
      enum: EXPENSE_PAYMENT_SOURCES,
      required: true,
      default: "add_payment",
    },
  },
  { timestamps: true }
);

ExpensePaymentLineSchema.index({ companyId: 1, expenseId: 1, paidAt: -1, createdAt: -1 });
ExpensePaymentLineSchema.index({ companyId: 1, createdBy: 1, createdAt: -1 });

export default mongoose.models.ExpensePaymentLine ||
  mongoose.model("ExpensePaymentLine", ExpensePaymentLineSchema);
