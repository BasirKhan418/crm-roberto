import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextRequest, NextResponse } from "next/server";

import { getS3Client } from "@/utils/s3/s3Client";
import { authorizeExpenseRoute } from "@/app/api/expenses/_shared";
import { expenseUploadPresignSchema } from "@/validators/expense.schema";
import { buildValidationError } from "@/utils/api/validation";
import {
  EXPENSE_MAX_FILE_SIZE_BYTES,
  formatFileSizeMb,
  getExpenseFileExtension,
  isExpenseMimeTypeAllowed,
} from "@/lib/expenses/upload";
import { buildPrivateStoragePlaceholderUrl } from "@/lib/storage/private-file-urls";

const BUCKET = process.env.AWS_S3_BUCKET || "";
const URL_EXPIRES_IN_SECONDS = 60 * 5;

export async function POST(request: NextRequest) {
  try {
    const auth = await authorizeExpenseRoute("manage");
    if (!auth.success) {
      return auth.response;
    }

    if (!BUCKET) {
      return NextResponse.json(
        { success: false, message: "AWS_S3_BUCKET is not configured" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const parsed = expenseUploadPresignSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(buildValidationError(parsed.error), { status: 400 });
    }

    if (!isExpenseMimeTypeAllowed(parsed.data.fileType)) {
      return NextResponse.json(
        { success: false, message: "Unsupported file type for expenses" },
        { status: 400 }
      );
    }

    if (parsed.data.fileSize > EXPENSE_MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        {
          success: false,
          message: `File too large. Max ${formatFileSizeMb(EXPENSE_MAX_FILE_SIZE_BYTES)} MB allowed`,
        },
        { status: 400 }
      );
    }

    const extension = getExpenseFileExtension(parsed.data.fileName, parsed.data.fileType);
    const key = `expenses/${auth.context.user.companyId}/${auth.context.user.id}/${Date.now()}-${crypto.randomUUID()}.${extension}`;

    const putCommand = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: parsed.data.fileType,
      CacheControl: "max-age=31536000",
    });

    const uploadUrl = await getSignedUrl(getS3Client(), putCommand, { expiresIn: URL_EXPIRES_IN_SECONDS });
    const fileUrl = buildPrivateStoragePlaceholderUrl(key);

    return NextResponse.json(
      {
        success: true,
        uploadUrl,
        fileUrl,
        key,
        expiresIn: URL_EXPIRES_IN_SECONDS,
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, message: `Error generating expense upload url: ${String(error)}` },
      { status: 500 }
    );
  }
}
