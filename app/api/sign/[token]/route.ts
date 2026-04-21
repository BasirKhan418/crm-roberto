import { NextRequest, NextResponse } from "next/server";

import ConnectDb from "@/db/connectDb";
import CompanyProfile from "@/db/models/CompanyProfile";
import Quote from "@/db/models/Quote";
import QuoteSignature from "@/db/models/QuoteSignature";
import { createActivityLog } from '@/db/repository/activity';
import User from "@/db/models/User";
import { sendQuoteRejectionNotification } from "@/lib/email";
import { buildQuoteConversation } from '@/lib/quote-conversation';
import { isTokenExpired } from "@/lib/tokens";

interface RouteParams {
  params: Promise<{ token: string }>;
}

function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  const realIp = request.headers.get("x-real-ip");
  return realIp?.trim() || "unknown";
}

async function findQuoteByToken(token: string) {
  return Quote.findOne({ signatureToken: token });
}

async function findRejectedQuoteByToken(token: string) {
  return Quote.findOne({ rejectedSignToken: token });
}

type QuoteDocument = NonNullable<Awaited<ReturnType<typeof findQuoteByToken>>>;

async function buildQuotePayload(quote: QuoteDocument) {
  const companyProfile = await CompanyProfile.findOne({ user: quote.user })
    .select({ companyName: 1, ownerName: 1, logoUrl: 1, address: 1, streetNumber: 1, streetName: 1, postalCode: 1, city: 1, country: 1, phone: 1, businessEmail: 1, vatNumber: 1 })
    .lean();

  const companyName =
    (companyProfile?.companyName as string | undefined) ||
    (companyProfile?.ownerName as string | undefined) ||
    "Our Company";
  const logoUrl = (companyProfile?.logoUrl as string | null | undefined) ?? null;

  return {
    company: {
      companyName,
      logoUrl,
      address: (companyProfile?.address as string | undefined) || null,
      streetNumber: (companyProfile?.streetNumber as string | null | undefined) ?? null,
      streetName: (companyProfile?.streetName as string | null | undefined) ?? null,
      postalCode: (companyProfile?.postalCode as string | null | undefined) ?? null,
      city: (companyProfile?.city as string | null | undefined) ?? null,
      country: (companyProfile?.country as string | null | undefined) ?? null,
      phone: (companyProfile?.phone as string | undefined) || null,
      email: (companyProfile?.businessEmail as string | undefined) || null,
      vatNumber: (companyProfile?.vatNumber as string | undefined) || null,
    },
    quoteNumber: quote.quoteNumber,
    date: quote.date,
    clientSnapshot: quote.clientSnapshot,
    lineItems: quote.lineItems,
    totalExcludingTax: quote.totalExcludingTax,
    totalVat: quote.totalVat,
    totalIncludingTax: quote.totalIncludingTax,
    notes: quote.notes,
  };
}

async function buildAlreadySignedPayload(quote: QuoteDocument, fallbackSignedAt?: Date | string | null) {
  const payload = await buildQuotePayload(quote);
  const signedAtValue =
    quote.signedAt instanceof Date
      ? quote.signedAt
      : quote.signedAt
        ? new Date(quote.signedAt)
        : fallbackSignedAt instanceof Date
          ? fallbackSignedAt
          : fallbackSignedAt
            ? new Date(fallbackSignedAt)
            : null;

  return {
    ...payload,
    state: "already_signed" as const,
    signedAt: signedAtValue?.toISOString() ?? null,
  };
}

async function buildAlreadySignedPayloadByToken(token: string) {
  const existingSignature = await QuoteSignature.findOne({ token, isUsed: true })
    .select({ quoteId: 1, signedAt: 1 })
    .lean();

  if (!existingSignature) {
    return null;
  }

  const signedQuote = await Quote.findById(existingSignature.quoteId);
  if (!signedQuote) {
    return {
      error: "already_signed" as const,
      signedAt: existingSignature.signedAt?.toISOString() ?? null,
    };
  }

  return buildAlreadySignedPayload(signedQuote, existingSignature.signedAt);
}

async function buildRejectedPayload(quote: QuoteDocument) {
  const companyProfile = await CompanyProfile.findOne({ user: quote.user })
    .select({ companyName: 1, ownerName: 1, logoUrl: 1, address: 1, phone: 1, businessEmail: 1, vatNumber: 1 })
    .lean();

  const companyName =
    (companyProfile?.companyName as string | undefined) ||
    (companyProfile?.ownerName as string | undefined) ||
    "Our Company";
  const logoUrl = (companyProfile?.logoUrl as string | null | undefined) ?? null;

  const q = quote as unknown as {
    rejectionComment?: string | null;
    adminReplyMessage?: string | null;
    conversationMessages?: Array<{ role: string; text: string; sentAt: Date }>;
  };

  return {
    state: "rejected" as const,
    company: {
      companyName,
      logoUrl,
      address: (companyProfile?.address as string | undefined) || null,
      phone: (companyProfile?.phone as string | undefined) || null,
      email: (companyProfile?.businessEmail as string | undefined) || null,
      vatNumber: (companyProfile?.vatNumber as string | undefined) || null,
    },
    quoteNumber: quote.quoteNumber,
    date: quote.date,
    clientSnapshot: quote.clientSnapshot,
    lineItems: quote.lineItems,
    totalExcludingTax: quote.totalExcludingTax,
    totalVat: quote.totalVat,
    totalIncludingTax: quote.totalIncludingTax,
    notes: quote.notes,
    rejectionComment: q.rejectionComment ?? null,
    adminReplyMessage: q.adminReplyMessage ?? null,
    conversationMessages: buildQuoteConversation(q),
  };
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  await ConnectDb();

  const { token } = await params;
  const quote = await findQuoteByToken(token);

  if (!quote) {
    const alreadySignedPayload = await buildAlreadySignedPayloadByToken(token);
    if (alreadySignedPayload) {
      return NextResponse.json(alreadySignedPayload);
    }

    // Check if the token belongs to a rejected quote (rejectedSignToken was preserved)
    const rejectedQuote = await findRejectedQuoteByToken(token);
    if (rejectedQuote) {
      // Quote was resent (or otherwise moved out of rejected state) — old link is stale
      if (rejectedQuote.status !== "rejected") {
        const cpDoc = await CompanyProfile.findOne({ user: rejectedQuote.user })
          .select({ companyName: 1, ownerName: 1 })
          .lean();
        const companyName =
          (cpDoc?.companyName as string | undefined) ||
          (cpDoc?.ownerName as string | undefined) ||
          "Our Company";
        return NextResponse.json({ error: "link_no_longer_valid", companyName }, { status: 410 });
      }
      return NextResponse.json(await buildRejectedPayload(rejectedQuote));
    }

    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const payload = await buildQuotePayload(quote);
  const companyName = payload.company.companyName;

  if (quote.status === "draft") {
    return NextResponse.json({ error: "link_no_longer_valid", companyName }, { status: 410 });
  }

  if (isTokenExpired(quote.signatureTokenExpiry ?? null)) {
    return NextResponse.json({ error: "expired", companyName }, { status: 410 });
  }

  if (quote.signedStatus === "signed") {
    return NextResponse.json(await buildAlreadySignedPayload(quote));
  }

  return NextResponse.json(payload);
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  await ConnectDb();

  const { token } = await params;
  const body = (await request.json()) as { signatureDataUrl?: string };
  const signatureDataUrl = body.signatureDataUrl;

  if (!signatureDataUrl || !signatureDataUrl.startsWith("data:image/png;base64,")) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  const quote = await findQuoteByToken(token);
  if (!quote) {
    const alreadySignedPayload = await buildAlreadySignedPayloadByToken(token);
    if (alreadySignedPayload) {
      return NextResponse.json(alreadySignedPayload, { status: 409 });
    }

    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (quote.status === "draft") {
    return NextResponse.json({ error: "link_no_longer_valid" }, { status: 410 });
  }

  if (isTokenExpired(quote.signatureTokenExpiry ?? null)) {
    return NextResponse.json({ error: "expired" }, { status: 410 });
  }

  if (!quote.signatureTokenExpiry) {
    return NextResponse.json({ error: "expired" }, { status: 410 });
  }

  if (quote.signedStatus === "signed") {
    return NextResponse.json(await buildAlreadySignedPayload(quote), { status: 409 });
  }

  if (quote.status === "rejected") {
    return NextResponse.json({ error: "already_rejected" }, { status: 409 });
  }

  const signedAt = new Date();
  const clientIp = getClientIp(request);
  const clientUserAgent = request.headers.get("user-agent")?.trim() || "unknown";

  try {
    await QuoteSignature.create({
      quoteId: quote._id,
      userId: quote.user,
      token,
      tokenExpiry: quote.signatureTokenExpiry,
      signatureDataUrl,
      signedAt,
      clientIp,
      clientUserAgent,
      isUsed: true,
    });
  } catch (error) {
    const isDuplicate =
      Boolean(error) &&
      typeof error === "object" &&
      (error as { code?: number }).code === 11000;

    if (!isDuplicate) {
      throw error;
    }

    const alreadySignedPayload = await buildAlreadySignedPayloadByToken(token);
    if (alreadySignedPayload) {
      return NextResponse.json(alreadySignedPayload, { status: 409 });
    }

    return NextResponse.json({ error: "already_signed" }, { status: 409 });
  }

  quote.signedStatus = "signed";
  const previousStatus = quote.status;
  quote.status = "accepted";
  quote.signedAt = signedAt;
  quote.signatureToken = null;
  quote.signatureTokenExpiry = null;
  quote.statusHistory.push({
    from: previousStatus,
    to: "accepted",
    changedAt: signedAt,
  });
  await quote.save();

  try {
    await createActivityLog(String(quote.user), {
      action: 'quote_status_changed',
      entityType: 'quote',
      entityName: quote.quoteNumber,
      entityId: String(quote._id),
      metadata: {
        from: previousStatus,
        to: 'accepted',
        source: 'client_signature',
      },
    });
  } catch {
    // Notification failure must not block the signature confirmation flow.
  }

  return NextResponse.json({ message: "Quote signed successfully", signedAt: signedAt.toISOString() });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  await ConnectDb();

  const { token } = await params;
  const body = (await request.json()) as { comment?: string };
  const comment = typeof body.comment === "string" ? body.comment.trim().slice(0, 1000) : null;

  const quote = await findQuoteByToken(token);
  if (!quote) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (quote.status === "draft") {
    return NextResponse.json({ error: "link_no_longer_valid" }, { status: 410 });
  }

  if (isTokenExpired(quote.signatureTokenExpiry ?? null)) {
    return NextResponse.json({ error: "expired" }, { status: 410 });
  }

  if (quote.signedStatus === "signed") {
    return NextResponse.json({ error: "already_signed" }, { status: 409 });
  }

  if (quote.status === "rejected") {
    return NextResponse.json({ error: "already_rejected" }, { status: 409 });
  }

  const previousStatus = quote.status;
  const rejectedAt = new Date();
  quote.status = "rejected";
  quote.rejectionComment = comment ?? null;
  (
    quote as unknown as {
      conversationMessages?: Array<{ role: 'admin' | 'client'; text: string; sentAt: Date }>;
    }
  ).conversationMessages = comment
    ? [{ role: 'client', text: comment, sentAt: rejectedAt }]
    : [];
  (quote as unknown as { rejectedSignToken: string | null }).rejectedSignToken = token;
  quote.signatureToken = null;
  quote.signatureTokenExpiry = null;
  quote.statusHistory.push({
    from: previousStatus,
    to: "rejected",
    changedAt: rejectedAt,
  });
  await quote.save();

  try {
    await createActivityLog(String(quote.user), {
      action: 'quote_status_changed',
      entityType: 'quote',
      entityName: quote.quoteNumber,
      entityId: String(quote._id),
      metadata: {
        from: previousStatus,
        to: 'rejected',
        source: 'client_rejection',
      },
    });
  } catch {
  }

  (async () => {
    try {
      const adminUser = await User.findById(quote.user).select("email name").lean();
      const adminEmail = (adminUser as { email?: string } | null)?.email;
      const adminName = (adminUser as { name?: string } | null)?.name ?? "Admin";
      if (!adminEmail) return;

      const companyProfile = await CompanyProfile.findOne({ user: quote.user })
        .select("companyName ownerName")
        .lean();
      const companyName =
        (companyProfile?.companyName as string | undefined) ||
        (companyProfile?.ownerName as string | undefined) ||
        "Your Company";

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "";
      const quoteDetailUrl = appUrl ? `${appUrl}/quotes/${String(quote._id)}` : "";

      await sendQuoteRejectionNotification({
        to: adminEmail,
        adminName,
        companyName,
        quoteNumber: quote.quoteNumber,
        clientName: quote.clientSnapshot?.fullName ?? "Client",
        rejectionComment: comment,
        quoteDetailUrl,
      });
    } catch {
      // email failure must not affect the client response
    }
  })();

  return NextResponse.json({ message: "Quote rejected" });
}
