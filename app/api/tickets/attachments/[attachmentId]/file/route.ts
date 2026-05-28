import { GetObjectCommand } from "@aws-sdk/client-s3";
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";

import { authorizeTicketRoute } from "@/app/api/tickets/_shared";
import ConnectDb from "@/db/connectDb";
import Ticket from "@/db/models/Ticket";
import TicketAttachment from "@/db/models/TicketAttachment";
import { getS3Client } from "@/utils/s3/s3Client";

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

function withTicketAccess(query: Record<string, unknown>, userId: string, ownOrAssignedOnly: boolean) {
  if (!ownOrAssignedOnly || !isValidObjectId(userId)) {
    return query;
  }

  const requesterId = new mongoose.Types.ObjectId(userId);
  return {
    $and: [query, { $or: [{ createdBy: requesterId }, { assignedTo: requesterId }] }],
  };
}

function buildUnauthorizedResponse(request: NextRequest) {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(loginUrl);
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    if (!BUCKET) {
      return NextResponse.json({ success: false, message: "AWS_S3_BUCKET is not configured" }, { status: 500 });
    }

    const auth = await authorizeTicketRoute("view");
    if (!auth.success) {
      return auth.response.status === 401 ? buildUnauthorizedResponse(request) : auth.response;
    }

    const { attachmentId } = await params;
    if (!isValidObjectId(attachmentId)) {
      return NextResponse.json({ success: false, message: "Invalid attachment id" }, { status: 400 });
    }

    await ConnectDb();

    const attachment = await TicketAttachment.findOne({
      _id: attachmentId,
      companyId: auth.context.user.companyId,
    })
      .select("ticketId displayName originalName mimeType storageKey")
      .lean<{
        ticketId?: mongoose.Types.ObjectId;
        displayName?: string;
        originalName?: string;
        mimeType?: string;
        storageKey?: string;
      } | null>();

    if (!attachment?.ticketId || !attachment.storageKey) {
      return NextResponse.json({ success: false, message: "Attachment not found" }, { status: 404 });
    }

    const ticket = await Ticket.findOne(
      withTicketAccess(
        {
          _id: attachment.ticketId,
          companyId: auth.context.user.companyId,
        },
        auth.context.user.id,
        auth.context.accessScope.ownOrAssignedOnly
      )
    )
      .select("_id")
      .lean();

    if (!ticket) {
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
      { success: false, message: `Error fetching ticket attachment: ${String(error)}` },
      { status: 500 }
    );
  }
}