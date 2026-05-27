import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextRequest, NextResponse } from "next/server";

import { getS3Client } from "@/utils/s3/s3Client";
import { authorizeTicketRoute } from "@/app/api/tickets/_shared";
import { buildValidationError } from "@/utils/api/validation";
import { expenseUploadPresignSchema } from "@/validators/expense.schema";
import {
  formatFileSizeMb,
  getExpenseFileExtension,
} from "@/lib/expenses/upload";
import {
  isTicketMimeTypeAllowed,
  TICKET_MAX_FILE_SIZE_BYTES,
} from "@/lib/tickets/constants";

const BUCKET = process.env.AWS_S3_BUCKET || "";
const REGION = process.env.AWS_REGION || "eu-west-3";
const URL_EXPIRES_IN_SECONDS = 60 * 5;

export async function POST(request: NextRequest) {
  try {
    const auth = await authorizeTicketRoute("manage");
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

    if (!isTicketMimeTypeAllowed(parsed.data.fileType)) {
      return NextResponse.json(
        { success: false, message: "Unsupported file type for ticket attachments" },
        { status: 400 }
      );
    }

    if (parsed.data.fileSize > TICKET_MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        {
          success: false,
          message: `File too large. Max ${formatFileSizeMb(TICKET_MAX_FILE_SIZE_BYTES)} MB allowed`,
        },
        { status: 400 }
      );
    }

    const extension = getExpenseFileExtension(parsed.data.fileName, parsed.data.fileType);
    const key = `tickets/${auth.context.user.companyId}/${auth.context.user.id}/${Date.now()}-${crypto.randomUUID()}.${extension}`;

    const putCommand = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: parsed.data.fileType,
      CacheControl: "max-age=31536000",
    });

    const uploadUrl = await getSignedUrl(getS3Client(), putCommand, { expiresIn: URL_EXPIRES_IN_SECONDS });
    const fileUrl = `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;

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
      { success: false, message: `Error generating ticket upload url: ${String(error)}` },
      { status: 500 }
    );
  }
}
