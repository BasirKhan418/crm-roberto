import { NextRequest, NextResponse } from 'next/server';

import { buildVatSummaryExport, recordReportAudit } from '@/db/repository/accountant-exports';
import { parseAccountantExportRequest } from '@/app/api/accountant/exports/_shared';
import { authorizeCompanyExportRoute } from '@/app/api/exports/_shared';
import { getClientIp } from '@/utils/api/request';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const auth = await authorizeCompanyExportRoute();
    if (!auth.success) {
      return auth.response;
    }

    const parsed = parseAccountantExportRequest(request);
    if (!parsed.success) {
      return parsed.response;
    }

    const format = parsed.data.format || 'csv';
    const type = parsed.data.type || 'all';
    const locale = parsed.data.locale || (auth.user.locale === 'en' ? 'en' : 'fr');

    const result = await buildVatSummaryExport({
      companyId: auth.user.companyId,
      locale,
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
      companyId: auth.user.companyId,
      userId: auth.user.id,
      action: 'downloaded',
      entityId: 'vat_summary',
      ipAddress: getClientIp(request),
      details: {
        reportKey: 'vat_summary',
        type,
        format,
        locale,
        fileType: format.toUpperCase(),
        fileName: result.data.fileName,
        status: parsed.data.status || null,
        categoryId: parsed.data.categoryId || null,
      },
    });

    return new NextResponse(new Uint8Array(result.data.buffer), {
      status: 200,
      headers: {
        'Content-Type': result.data.contentType,
        'Content-Disposition': `attachment; filename="${result.data.fileName}"`,
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: `Error exporting VAT summary: ${String(error)}` }, { status: 500 });
  }
}