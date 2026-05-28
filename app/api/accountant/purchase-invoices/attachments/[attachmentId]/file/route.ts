import { GetObjectCommand } from "@aws-sdk/client-s3";
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";

import ConnectDb from "@/db/connectDb";
import Expense from "@/db/models/Expense";
import ExpenseAttachment from "@/db/models/ExpenseAttachment";
import { getS3Client } from "@/utils/s3/s3Client";
import getAccountantSession from "@/utils/middlewares/accountantSession";

export const runtime = "nodejs";

const BUCKET = process.env.AWS_S3_BUCKET || "";

interface RouteParams {
  params: Promise<{ attachmentId: string }>;
}

function isValidObjectId(value: string) {
  return mongoose.Types.ObjectId.isValid(value);
}

function sanitizeFilename(value: string | null | undefined) {
  const trimmed = String(value || "attachment").trim();
  const withoutUnsafe = trimmed.replace(/[\r\n"\\]/g, "-");
  return withoutUnsafe || "attachment";
}

function buildUnauthorizedResponse(request: NextRequest) {
  const loginUrl = new URL("/accountant-portal/login", request.url);
  loginUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(loginUrl);
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    if (!BUCKET) {
      return NextResponse.json({ success: false, message: "AWS_S3_BUCKET is not configured" }, { status: 500 });
    }

    const session = await getAccountantSession();
    if (!session.success || !session.user) {
      return buildUnauthorizedResponse(request);
    }

    const { attachmentId } = await params;
    if (!isValidObjectId(attachmentId)) {
      return NextResponse.json({ success: false, message: "Invalid attachment id" }, { status: 400 });
    }

    await ConnectDb();

    const attachment = await ExpenseAttachment.findOne({
      _id: attachmentId,
      companyId: session.user.companyId,
    })
      .select("expenseId displayName originalName mimeType storageKey")
      .lean<{
        expenseId?: mongoose.Types.ObjectId;
        displayName?: string;
        originalName?: string;
        mimeType?: string;
        storageKey?: string;
      } | null>();

    if (!attachment?.expenseId || !attachment.storageKey) {
      return NextResponse.json({ success: false, message: "Attachment not found" }, { status: 404 });
    }

    const expense = await Expense.findOne({
      _id: attachment.expenseId,
      companyId: session.user.companyId,
      deletedAt: null,
      status: "active",
    })
      .select("_id")
      .lean();

    if (!expense) {
      return NextResponse.json({ success: false, message: "Attachment not found" }, { status: 404 });
    }

    const objectResponse = await getS3Client().send(
      new GetObjectCommand({
        Bucket: BUCKET,
        Key: attachment.storageKey,
      })
    );

    if (!objectResponse.Body) {
      return NextResponse.json({ success: false, message: "Attachment file is empty" }, { status: 404 });
    }

    const fileBuffer = Buffer.from(await objectResponse.Body.transformToByteArray());
    const fileName = sanitizeFilename(attachment.displayName || attachment.originalName);

    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        "Content-Type": objectResponse.ContentType || attachment.mimeType || "application/octet-stream",
        "Content-Disposition": `inline; filename="${fileName}"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: `Error fetching purchase attachment: ${String(error)}` },
      { status: 500 }
    );
  }
}