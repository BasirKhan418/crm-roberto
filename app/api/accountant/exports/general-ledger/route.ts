import { NextRequest, NextResponse } from "next/server";

import { buildGeneralLedgerExport, recordReportAudit } from "@/db/repository/accountant-exports";
import { parseAccountantExportRequest } from "@/app/api/accountant/exports/_shared";
import getAccountantSession from "@/utils/middlewares/accountantSession";
import { getClientIp } from "@/utils/api/request";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const session = await getAccountantSession();
    if (!session.success || !session.user) {
      return NextResponse.json({ success: false, message: session.message || "Unauthorized" }, { status: 401 });
    }
    if (session.user.featureFlags?.exports === false) {
      return NextResponse.json({ success: false, message: "Feature disabled" }, { status: 403 });
    }

    const parsed = parseAccountantExportRequest(request);
    if (!parsed.success) {
      return parsed.response;
    }

    const format = parsed.data.format || "csv";
    const type = parsed.data.type || "all";

    const result = await buildGeneralLedgerExport({
      companyId: session.user.companyId,
      locale: session.user.locale === "en" ? "en" : "fr",
      type,
      format,
      status: parsed.data.status,
      categoryId: parsed.data.categoryId,
      period: parsed.data.period,
    });

    if (!result.success) {
      return NextResponse.json(result, { status: result.status });
    }

    await recordReportAudit({
      companyId: session.user.companyId,
      userId: session.user.id,
      action: "exported",
      entityId: "general_ledger",
      ipAddress: getClientIp(request),
      details: { type, format, status: parsed.data.status || null, categoryId: parsed.data.categoryId || null },
    });

    return new NextResponse(new Uint8Array(result.data.buffer), {
      status: 200,
      headers: {
        "Content-Type": result.data.contentType,
        "Content-Disposition": `attachment; filename="${result.data.fileName}"`,
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: `Error exporting general ledger: ${String(error)}` }, { status: 500 });
  }
}