import { PutObjectCommand } from "@aws-sdk/client-s3";
import { NextRequest, NextResponse } from "next/server";

import {
  createExpenseAttachment,
  deleteExpenseAttachment,
  listExpenseAttachments,
} from "@/db/repository/expense";
import { authorizeExpenseRoute } from "@/app/api/expenses/_shared";
import {
  createExpenseAttachmentSchema,
  deleteExpenseAttachmentSchema,
} from "@/validators/expense.schema";
import { buildValidationError } from "@/utils/api/validation";
import { getClientIp } from "@/utils/api/request";
import { getS3Client } from "@/utils/s3/s3Client";
import {
  EXPENSE_ALLOWED_MIME_TYPES,
  EXPENSE_MAX_FILE_SIZE_BYTES,
  formatFileSizeMb,
  getExpenseFileExtension,
  isExpenseMimeTypeAllowed,
} from "@/lib/expenses/upload";
import { buildPrivateStoragePlaceholderUrl } from "@/lib/storage/private-file-urls";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const BUCKET = process.env.AWS_S3_BUCKET || "";
function inferUploadMimeType(
  fileName: string,
  fileType: string
): (typeof EXPENSE_ALLOWED_MIME_TYPES)[number] | null {
  if (isExpenseMimeTypeAllowed(fileType)) {
    return fileType as (typeof EXPENSE_ALLOWED_MIME_TYPES)[number];
  }

  const extension = fileName.split(".").pop()?.toLowerCase();
  if (extension === "pdf") return "application/pdf";
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "png") return "image/png";
  if (extension === "heic") return "image/heic";
  return null;
}

function resolveExpenseAttachmentStatus(message?: string) {
  const normalized = (message || "").toLowerCase();
  if (normalized.includes("not found")) return 404;
  if (normalized.includes("forbidden")) return 403;
  return 400;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await authorizeExpenseRoute("view");
    if (!auth.success) {
      return auth.response;
    }

    const { id } = await params;
    const result = await listExpenseAttachments({
      companyId: auth.context.user.companyId || "",
      expenseId: id,
      access: auth.context.accessScope,
    });

    if (!result.success) {
      return NextResponse.json(result, { status: 404 });
    }

    return NextResponse.json({ success: true, attachments: result.attachments }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: `Error fetching expense attachments: ${String(error)}` },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await authorizeExpenseRoute("manage");
    if (!auth.success) {
      return auth.response;
    }
    const { id } = await params;

    const contentType = request.headers.get("content-type") || "";
    let created:
      | Awaited<ReturnType<typeof createExpenseAttachment>>
      | null = null;

    if (contentType.includes("multipart/form-data")) {
      if (!BUCKET) {
        return NextResponse.json(
          { success: false, message: "AWS_S3_BUCKET is not configured" },
          { status: 500 }
        );
      }

      const formData = await request.formData();
      const maybeFile = formData.get("file");

      if (!(maybeFile instanceof File)) {
        return NextResponse.json(
          { success: false, message: "File is required" },
          { status: 400 }
        );
      }

      const mimeType = inferUploadMimeType(maybeFile.name || "", maybeFile.type || "");
      if (!mimeType) {
        return NextResponse.json(
          { success: false, message: "Unsupported file type for expenses" },
          { status: 400 }
        );
      }

      if (maybeFile.size > EXPENSE_MAX_FILE_SIZE_BYTES) {
        return NextResponse.json(
          {
            success: false,
            message: `File too large. Max ${formatFileSizeMb(EXPENSE_MAX_FILE_SIZE_BYTES)} MB allowed`,
          },
          { status: 400 }
        );
      }

      const extension = getExpenseFileExtension(maybeFile.name, mimeType);
      const key = `expenses/${auth.context.user.companyId}/${auth.context.user.id}/${Date.now()}-${crypto.randomUUID()}.${extension}`;

      const bodyBuffer = Buffer.from(await maybeFile.arrayBuffer());
      const putCommand = new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: bodyBuffer,
        ContentType: mimeType,
        CacheControl: "max-age=31536000",
      });

      await getS3Client().send(putCommand);

      const url = buildPrivateStoragePlaceholderUrl(key);

      created = await createExpenseAttachment({
        companyId: auth.context.user.companyId || "",
        expenseId: id,
        uploadedBy: auth.context.user.id,
        payload: {
          originalName: maybeFile.name,
          displayName: maybeFile.name,
          mimeType,
          extension,
          sizeBytes: maybeFile.size,
          storageKey: key,
          url,
          checksum: null,
        },
        access: auth.context.accessScope,
        ipAddress: getClientIp(request),
      });
    } else {
      const body = await request.json();
      const parsed = createExpenseAttachmentSchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json(buildValidationError(parsed.error), { status: 400 });
      }

      created = await createExpenseAttachment({
        companyId: auth.context.user.companyId || "",
        expenseId: id,
        uploadedBy: auth.context.user.id,
        payload: parsed.data.attachment,
        access: auth.context.accessScope,
        ipAddress: getClientIp(request),
      });
    }

    if (!created || !created.success) {
      return NextResponse.json(created, { status: resolveExpenseAttachmentStatus(created.message) });
    }

    return NextResponse.json(
      {
        success: true,
        message: "Attachment metadata saved",
        attachment: created.attachment,
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, message: `Error creating expense attachment metadata: ${String(error)}` },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await authorizeExpenseRoute("manage");
    if (!auth.success) {
      return auth.response;
    }

    const body = await request.json();
    const parsed = deleteExpenseAttachmentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(buildValidationError(parsed.error), { status: 400 });
    }

    const { id } = await params;
    const deleted = await deleteExpenseAttachment({
      companyId: auth.context.user.companyId || "",
      expenseId: id,
      attachmentId: parsed.data.attachmentId,
      reason: parsed.data.reason,
      reasonDetails: parsed.data.reasonDetails ?? null,
      deletedBy: auth.context.user.id,
      access: auth.context.accessScope,
      ipAddress: getClientIp(request),
    });

    if (!deleted.success) {
      return NextResponse.json(deleted, { status: resolveExpenseAttachmentStatus(deleted.message) });
    }

    return NextResponse.json({ success: true, attachment: deleted.attachment }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: `Error deleting expense attachment metadata: ${String(error)}` },
      { status: 500 }
    );
  }
}
