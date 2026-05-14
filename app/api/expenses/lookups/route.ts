import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";

import { authorizeExpenseRoute } from "@/app/api/expenses/_shared";
import Client from "@/db/models/Client";
import Invoice from "@/db/models/Invoice";
import Supplier from "@/db/models/Supplier";
import User from "@/db/models/User";
import { createSupplier } from "@/db/repository/supplier";
import { listExpenseCategories } from "@/db/repository/expenseCategory";
import {
  createExpenseInlineSupplierSchema,
  expenseLookupQuerySchema,
} from "@/validators/expense.schema";
import { buildValidationError } from "@/utils/api/validation";

type LookupUser = { _id: mongoose.Types.ObjectId };

async function getCompanyUserIds(companyId: string) {
  const users = await User.find({ companyId })
    .select("_id")
    .lean<LookupUser[]>();

  return users.map((user) => user._id);
}

export async function GET(request: NextRequest) {
  try {
    const auth = await authorizeExpenseRoute("view");
    if (!auth.success) {
      return auth.response;
    }

    const parsedQuery = expenseLookupQuerySchema.safeParse({
      search: request.nextUrl.searchParams.get("search") || undefined,
      limit: request.nextUrl.searchParams.get("limit") || undefined,
    });

    if (!parsedQuery.success) {
      return NextResponse.json(buildValidationError(parsedQuery.error), { status: 400 });
    }

    const search = parsedQuery.data.search || "";
    const limit = parsedQuery.data.limit || 20;

    const companyUserIds = await getCompanyUserIds(auth.context.user.companyId || "");

    const categoriesPromise = listExpenseCategories(auth.context.user.companyId || "", false);

    const suppliersPromise = Supplier.find({
      user: { $in: companyUserIds },
      ...(search
        ? {
            $or: [
              { fullName: { $regex: search, $options: "i" } },
              { companyName: { $regex: search, $options: "i" } },
              { email: { $regex: search, $options: "i" } },
            ],
          }
        : {}),
    })
      .select("_id fullName companyName email")
      .sort({ fullName: 1 })
      .limit(limit)
      .lean();

    const clientsPromise = Client.find({
      user: { $in: companyUserIds },
      ...(search
        ? {
            $or: [
              { fullName: { $regex: search, $options: "i" } },
              { companyName: { $regex: search, $options: "i" } },
              { email: { $regex: search, $options: "i" } },
            ],
          }
        : {}),
    })
      .select("_id fullName companyName email")
      .sort({ fullName: 1 })
      .limit(limit)
      .lean();

    const invoicesPromise = Invoice.find({
      userId: { $in: companyUserIds },
      ...(search
        ? {
            $or: [
              { invoiceNumber: { $regex: search, $options: "i" } },
              { "clientSnapshot.fullName": { $regex: search, $options: "i" } },
            ],
          }
        : {}),
    })
      .select("_id invoiceNumber totalIncludingTax status clientSnapshot.fullName")
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const [categoriesResult, suppliers, clients, invoices] = await Promise.all([
      categoriesPromise,
      suppliersPromise,
      clientsPromise,
      invoicesPromise,
    ]);

    if (!categoriesResult.success) {
      return NextResponse.json(
        { success: false, message: categoriesResult.message || "Failed to load categories" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        categories: categoriesResult.categories,
        suppliers,
        clients,
        invoices,
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, message: `Error loading expense lookups: ${String(error)}` },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authorizeExpenseRoute("manage");
    if (!auth.success) {
      return auth.response;
    }

    const body = await request.json();
    const parsed = createExpenseInlineSupplierSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(buildValidationError(parsed.error), { status: 400 });
    }

    const supplier = await createSupplier(auth.context.user.id, {
      fullName: parsed.data.fullName,
      contactName: parsed.data.contactName || undefined,
      email: parsed.data.email || undefined,
      phone: parsed.data.phone || undefined,
      category: "other",
      tags: undefined,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Supplier created",
        supplier,
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, message: `Error creating inline supplier: ${String(error)}` },
      { status: 500 }
    );
  }
}
