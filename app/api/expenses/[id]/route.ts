import { NextRequest, NextResponse } from "next/server";
import argon2 from "argon2";

import {
  archiveExpense,
  deleteDraftExpense,
  getExpenseById,
  softDeleteExpense,
  updateExpense
} from "@/db/repository/expense";
import { listLinkedTickets } from "@/db/repository/ticket";
import { authorizeExpenseRoute } from "@/app/api/expenses/_shared";
import { canPermanentlyDeleteExpense } from "@/lib/expenses/access";
import { getTicketPermissionState } from "@/lib/tickets/access";
import { permanentDeleteExpenseSchema, updateExpenseSchema } from "@/validators/expense.schema";
import { buildValidationError } from "@/utils/api/validation";
import { getClientIp } from "@/utils/api/request";
import ConnectDb from "@/db/connectDb";
import User from "@/db/models/User";

interface RouteParams {
  params: Promise<{ id: string }>;
}

function getDeleteMode(request: NextRequest): "archive" | "delete" | "draft-delete" {
  const mode = request.nextUrl.searchParams.get("mode")?.toLowerCase();
  if (mode === "archive" || mode === "draft-delete") {
    return mode;
  }

  return "delete";
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await authorizeExpenseRoute("view");
    if (!auth.success) {
      return auth.response;
    }

    const { id } = await params;
    const result = await getExpenseById({
      companyId: auth.context.user.companyId || "",
      expenseId: id,
      access: auth.context.accessScope,
    });

    if (!result.success) {
      return NextResponse.json(result, { status: 404 });
    }

    const ticketPermission = getTicketPermissionState(auth.context.user.role);
    let linkedTickets: Array<Record<string, unknown>> = [];

    if (ticketPermission.canView && auth.context.user.companyId) {
      const linkedTicketResult = await listLinkedTickets({
        companyId: auth.context.user.companyId,
        linkedType: "expense",
        linkedId: id,
        access: {
          userId: auth.context.user.id,
          ownOrAssignedOnly: ticketPermission.ownOrAssignedOnly,
        },
        limit: 30,
      });

      if (linkedTicketResult.success) {
        linkedTickets = linkedTicketResult.items;
      }
    }

    return NextResponse.json(
      {
        success: true,
        expense: {
          ...result.expense,
          linkedTickets,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, message: `Error fetching expense detail: ${String(error)}` },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await authorizeExpenseRoute("manage");
    if (!auth.success) {
      return auth.response;
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = updateExpenseSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(buildValidationError(parsed.error), { status: 400 });
    }

    const updated = await updateExpense({
      companyId: auth.context.user.companyId || "",
      expenseId: id,
      updatedBy: auth.context.user.id,
      payload: parsed.data,
      access: auth.context.accessScope,
      ipAddress: getClientIp(request),
    });

    if (!updated.success) {
      return NextResponse.json(updated, { status: updated.message.includes("not found") ? 404 : 400 });
    }

    return NextResponse.json({ success: true, expense: updated.expense }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: `Error updating expense: ${String(error)}` },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const mode = getDeleteMode(request);
    const auth = await authorizeExpenseRoute("manage");
    if (!auth.success) {
      return auth.response;
    }

    const { id } = await params;

    if (mode === "delete") {
      if (!canPermanentlyDeleteExpense(auth.context.user.role)) {
        return NextResponse.json(
          { success: false, message: "Only Super Admin can permanently delete expenses" },
          { status: 403 }
        );
      }

      let body: unknown = {};
      try {
        body = await request.json();
      } catch {
        body = {};
      }

      const parsedDeleteRequest = permanentDeleteExpenseSchema.safeParse(body);
      if (!parsedDeleteRequest.success) {
        return NextResponse.json(buildValidationError(parsedDeleteRequest.error), { status: 400 });
      }

      await ConnectDb();
      const actor = await User.findById(auth.context.user.id).select("+password");
      if (!actor) {
        return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
      }

      const pepper = process.env.PASSWORD_PEPPER || "";
      let isPasswordValid = await argon2.verify(
        actor.password,
        `${parsedDeleteRequest.data.password}${pepper}`
      );

      // Backward compatibility for accounts created before PASSWORD_PEPPER was configured.
      if (!isPasswordValid && pepper) {
        isPasswordValid = await argon2.verify(actor.password, parsedDeleteRequest.data.password);
      }

      if (!isPasswordValid) {
        return NextResponse.json(
          { success: false, message: "Password confirmation failed" },
          { status: 403 }
        );
      }

      const removed = await softDeleteExpense({
        companyId: auth.context.user.companyId || "",
        expenseId: id,
        updatedBy: auth.context.user.id,
        deleteReason: parsedDeleteRequest.data.deleteReason,
        access: auth.context.accessScope,
        ipAddress: getClientIp(request),
      });

      if (!removed.success) {
        return NextResponse.json(removed, { status: removed.message.includes("not found") ? 404 : 400 });
      }

      return NextResponse.json({ success: true, expense: removed.expense }, { status: 200 });
    }

    if (mode === "draft-delete") {
      const removedDraft = await deleteDraftExpense({
        companyId: auth.context.user.companyId || "",
        expenseId: id,
        updatedBy: auth.context.user.id,
        access: auth.context.accessScope,
        ipAddress: getClientIp(request),
      });

      if (!removedDraft.success) {
        return NextResponse.json(removedDraft, {
          status: removedDraft.message.includes("not found") ? 404 : 400,
        });
      }

      return NextResponse.json({ success: true, expense: removedDraft.expense }, { status: 200 });
    }

    if (mode === "archive") {
      const archived = await archiveExpense({
        companyId: auth.context.user.companyId || "",
        expenseId: id,
        updatedBy: auth.context.user.id,
        access: auth.context.accessScope,
        ipAddress: getClientIp(request),
      });

      if (!archived.success) {
        return NextResponse.json(archived, { status: 404 });
      }

      return NextResponse.json({ success: true, expense: archived.expense }, { status: 200 });
    }

    return NextResponse.json({ success: false, message: "Unsupported delete mode" }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: `Error removing expense: ${String(error)}` },
      { status: 500 }
    );
  }
}
