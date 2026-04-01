import { NextRequest, NextResponse } from "next/server";

import ConnectDb from "@/db/connectDb";
import CompanyProfile from "@/db/models/CompanyProfile";
import Quote from "@/db/models/Quote";
import QuoteSignature from "@/db/models/QuoteSignature";
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

export async function GET(_request: NextRequest, { params }: RouteParams) {
  await ConnectDb();

  const { token } = await params;
  const quote = await findQuoteByToken(token);

  if (!quote) {
    const alreadyUsed = await QuoteSignature.exists({ token, isUsed: true });
    if (alreadyUsed) {
      return NextResponse.json({ error: "already_signed" }, { status: 409 });
    }

    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const companyProfile = await CompanyProfile.findOne({ user: quote.user })
    .select({ companyName: 1, ownerName: 1, logoUrl: 1, address: 1, phone: 1, businessEmail: 1, vatNumber: 1 })
    .lean();

  const companyName =
    (companyProfile?.companyName as string | undefined) ||
    (companyProfile?.ownerName as string | undefined) ||
    "Our Company";
  const logoUrl = (companyProfile?.logoUrl as string | null | undefined) ?? null;

  if (isTokenExpired(quote.signatureTokenExpiry)) {
    return NextResponse.json({ error: "expired", companyName }, { status: 410 });
  }

  if (quote.signedStatus === "signed") {
    return NextResponse.json({ error: "already_signed" }, { status: 409 });
  }

  return NextResponse.json({
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
  });
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
    const alreadyUsed = await QuoteSignature.exists({ token, isUsed: true });
    if (alreadyUsed) {
      return NextResponse.json({ error: "already_signed" }, { status: 409 });
    }

    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (isTokenExpired(quote.signatureTokenExpiry)) {
    return NextResponse.json({ error: "expired" }, { status: 410 });
  }

  if (quote.signedStatus === "signed") {
    return NextResponse.json({ error: "already_signed" }, { status: 409 });
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

  return NextResponse.json({ message: "Quote signed successfully" });
}
