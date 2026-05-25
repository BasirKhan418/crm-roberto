import JSZip from "jszip";
import { NextRequest, NextResponse } from "next/server";

import { buildPurchaseAttachmentBundleInput, recordReportAudit } from "@/db/repository/accountant-exports";
import { authorizeAccountantTicketAccess } from "@/app/api/accountant/_shared/tickets";
import { buildValidationError } from "@/utils/api/validation";
import { accountantAttachmentZipSchema } from "@/validators/accountant-export.schema";
import { getClientIp } from "@/utils/api/request";

export const runtime = "nodejs";

function sanitizePathSegment(value: string) {
  return value.replace(/[<>:"/\\|?*]+/g, "-").trim() || "file";
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authorizeAccountantTicketAccess();
    if (!auth.success) {
      return auth.response;
    }

    const body = await request.json();
    const parsed = accountantAttachmentZipSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(buildValidationError(parsed.error), { status: 400 });
    }

    const bundleResult = await buildPurchaseAttachmentBundleInput({
      companyId: auth.context.user.companyId,
      expenseIds: parsed.data.expenseIds,
    });

    if (!bundleResult.success) {
      return NextResponse.json(bundleResult, { status: bundleResult.status });
    }

    const zip = new JSZip();
    const failures: string[] = [];

    for (const file of bundleResult.data.files) {
      try {
        const response = await fetch(file.url);
        if (!response.ok) {
          failures.push(`${file.fileName} -> ${response.status}`);
          continue;
        }

        const buffer = Buffer.from(await response.arrayBuffer());
        const folder = `${sanitizePathSegment(file.expenseDate || "undated")}-${sanitizePathSegment(file.supplierName)}`;
        zip.file(`${folder}/${sanitizePathSegment(file.fileName)}`, buffer);
      } catch (error) {
        failures.push(`${file.fileName} -> ${String(error)}`);
      }
    }

    if (failures.length > 0) {
      zip.file("README.txt", failures.join("\n"));
    }

    const zipBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });

    await recordReportAudit({
      companyId: auth.context.user.companyId,
      userId: auth.context.user.id,
      action: "downloaded",
      entityId: "purchase_attachments_zip",
      ipAddress: getClientIp(request),
      details: { expenseIds: parsed.data.expenseIds, fileCount: bundleResult.data.files.length },
    });

    return new NextResponse(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="purchase-invoice-attachments.zip"',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: `Error generating purchase attachment zip: ${String(error)}` },
      { status: 500 }
    );
  }
}