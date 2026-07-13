import { GetObjectCommand } from "@aws-sdk/client-s3";
import JSZip from "jszip";
import { NextRequest, NextResponse } from "next/server";

import { buildPurchaseAttachmentBundleInput, recordReportAudit } from "@/db/repository/accountant-exports";
import { authorizeAccountantTicketAccess } from "@/app/api/accountant/_shared/tickets";
import { buildValidationError } from "@/utils/api/validation";
import { accountantAttachmentZipSchema } from "@/validators/accountant-export.schema";
import { getClientIp } from "@/utils/api/request";
import { getS3Client } from "@/utils/s3/s3Client";

export const runtime = "nodejs";

const BUCKET = process.env.AWS_S3_BUCKET || "";

function sanitizePathSegment(value: string) {
  return value.replace(/[<>:"/\\|?*]+/g, "-").trim() || "file";
}

export async function POST(request: NextRequest) {
  try {
    if (!BUCKET) {
      return NextResponse.json({ success: false, message: "AWS_S3_BUCKET is not configured" }, { status: 500 });
    }

    const auth = await authorizeAccountantTicketAccess();
    if (!auth.success) {
      return auth.response;
    }
    if (auth.context.user.featureFlags?.exports === false) {
      return NextResponse.json({ success: false, message: "Feature disabled" }, { status: 403 });
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
        if (!file.storageKey) {
          failures.push(`${file.fileName} -> missing storage key`);
          continue;
        }

        const objectResponse = await getS3Client().send(
          new GetObjectCommand({
            Bucket: BUCKET,
            Key: file.storageKey,
          })
        );

        if (!objectResponse.Body) {
          failures.push(`${file.fileName} -> empty object body`);
          continue;
        }

        const buffer = Buffer.from(await objectResponse.Body.transformToByteArray());
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
      details: {
        reportKey: "purchase_attachments_zip",
        fileType: "ZIP",
        fileName: "purchase-invoice-attachments.zip",
        fileCount: bundleResult.data.files.length,
        expenseIds: parsed.data.expenseIds,
      },
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