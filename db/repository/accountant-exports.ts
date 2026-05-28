import mongoose from "mongoose";
import * as XLSX from "xlsx";

import ConnectDb from "@/db/connectDb";
import Company from "@/db/models/Company";
import Expense from "@/db/models/Expense";
import ExpenseAttachment from "@/db/models/ExpenseAttachment";
import Invoice from "@/db/models/Invoice";
import User from "@/db/models/User";
import { recordAuditLog } from "@/db/repository/audit";
import { resolveFinancialPeriod, type FinancialPeriodSelection } from "@/lib/financial-periods";
import { centsToEuros } from "@/lib/price";

type ExportType = "all" | "purchase" | "sale";
type ExportFormat = "csv" | "xlsx";
type ExportLocale = "en" | "fr";

type RepositoryErrorResult = {
  success: false;
  status: number;
  message: string;
};

type RepositorySuccessResult<T> = {
  success: true;
  data: T;
};

type RepositoryResult<T> = RepositoryErrorResult | RepositorySuccessResult<T>;

type ExportRow = Record<string, string | number>;

type WorkbookSheet = {
  name: string;
  rows: ExportRow[];
  headers?: string[];
};

type ExportFileKind = "accountingRows" | "vatSummary" | "generalLedger";

type AccountingRow = {
  sourceId: string;
  type: "purchase" | "sale";
  date: string;
  counterparty: string;
  reference: string;
  category: string;
  status: string;
  excludingVat: string;
  vat: string;
  includingVat: string;
};

type VatSummaryRow = {
  section: string;
  entryCount: number;
  excludingVat: string;
  vat: string;
  includingVat: string;
};

function buildVatBalanceSectionLabel(vatDeltaCents: number, locale: ExportLocale) {
  if (locale === "fr") {
    if (vatDeltaCents > 0) {
      return "Solde TVA à payer";
    }
    if (vatDeltaCents < 0) {
      return "Crédit de TVA";
    }
    return "Solde TVA nul";
  }

  if (vatDeltaCents > 0) {
    return "VAT payable balance";
  }
  if (vatDeltaCents < 0) {
    return "VAT credit balance";
  }
  return "VAT balance cleared";
}

type GeneralLedgerRow = {
  date: string;
  type: "purchase" | "sale";
  reference: string;
  counterparty: string;
  accountCode: string;
  accountLabel: string;
  entryLabel: string;
  debitCents: number;
  creditCents: number;
  status: string;
};

type PurchaseAttachmentBundleInput = {
  files: Array<{
    expenseId: string;
    expenseDate: string | null;
    supplierName: string;
    fileName: string;
    storageKey: string;
  }>;
};

type RawAccountingRow = {
  sourceId: string;
  type: "purchase" | "sale";
  date: Date | null;
  counterparty: string;
  reference: string;
  category: string;
  status: string;
  excludingVatCents: number;
  vatCents: number;
  includingVatCents: number;
};

const MAX_EXPORT_ROWS = 5000;
const MAX_ATTACHMENT_FILES = 250;

function isValidObjectId(value: string | null | undefined) {
  return Boolean(value && mongoose.Types.ObjectId.isValid(value));
}

function toObjectId(value: string) {
  return new mongoose.Types.ObjectId(value);
}

function toCents(value: unknown) {
  return Math.max(0, Math.round(Number(value) || 0));
}

function toIsoDate(value: Date | null | undefined) {
  if (!value || !Number.isFinite(value.getTime())) {
    return "";
  }

  return value.toISOString().slice(0, 10);
}

function escapeCsvCell(value: unknown) {
  const normalized = String(value ?? "");
  if (/[",\n;]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }

  return normalized;
}

function formatMoney(cents: number) {
  return centsToEuros(cents);
}

function slugifyFileSegment(value: string | null | undefined) {
  const normalized = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");

  return normalized || "export";
}

function formatEntryDate(value: Date | null | undefined, locale: ExportLocale) {
  if (!value || !Number.isFinite(value.getTime())) {
    return locale === "fr" ? "Date inconnue" : "Unknown date";
  }

  return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(value);
}

function localizeTypeLabel(type: "purchase" | "sale", locale: ExportLocale) {
  if (locale === "fr") {
    return type === "purchase" ? "Achat" : "Vente";
  }

  return type === "purchase" ? "Purchase" : "Sale";
}

function localizeExportTypeLabel(type: ExportType, locale: ExportLocale) {
  if (locale === "fr") {
    switch (type) {
      case "purchase":
        return "Achats uniquement";
      case "sale":
        return "Ventes uniquement";
      case "all":
      default:
        return "Achats et ventes";
    }
  }

  switch (type) {
    case "purchase":
      return "Purchase only";
    case "sale":
      return "Sales only";
    case "all":
    default:
      return "Purchases and sales";
  }
}

function localizeExportScopeToken(type: ExportType, locale: ExportLocale) {
  if (locale === "fr") {
    switch (type) {
      case "purchase":
        return "achats";
      case "sale":
        return "ventes";
      case "all":
      default:
        return "complet";
    }
  }

  switch (type) {
    case "purchase":
      return "purchases";
    case "sale":
      return "sales";
    case "all":
    default:
      return "full";
  }
}

function localizeExportFileBaseName(kind: ExportFileKind, locale: ExportLocale) {
  if (locale === "fr") {
    switch (kind) {
      case "generalLedger":
        return "grand_livre";
      case "vatSummary":
        return "resume_tva";
      case "accountingRows":
      default:
        return "ecritures_comptables";
    }
  }

  switch (kind) {
    case "generalLedger":
      return "general_ledger";
    case "vatSummary":
      return "vat_summary";
    case "accountingRows":
    default:
      return "accounting_rows";
  }
}

function localizeStatusLabel(status: string, locale: ExportLocale) {
  const normalized = status.trim().toLowerCase();

  if (locale === "fr") {
    switch (normalized) {
      case "paid":
        return "Réglé";
      case "partial":
      case "partial_paid":
        return "Paiement partiel";
      case "overdue":
        return "En retard";
      case "unpaid":
      default:
        return "Impayé";
    }
  }

  switch (normalized) {
    case "paid":
      return "Paid";
    case "partial":
    case "partial_paid":
      return "Partially paid";
    case "overdue":
      return "Overdue";
    case "unpaid":
    default:
      return "Unpaid";
  }
}

function getUnknownCounterparty(type: "purchase" | "sale", locale: ExportLocale) {
  if (locale === "fr") {
    return type === "purchase" ? "Fournisseur inconnu" : "Client inconnu";
  }

  return type === "purchase" ? "Unknown supplier" : "Unknown client";
}

function buildEntryLabel(row: RawAccountingRow, locale: ExportLocale) {
  if (row.type === "sale") {
    const base = locale === "fr" ? "Facture client" : "Customer invoice";
    return row.reference ? `${base} ${row.reference}` : `${base} ${row.counterparty}`;
  }

  return [row.category, row.counterparty, formatEntryDate(row.date, locale)].filter(Boolean).join(" ");
}

function buildBalanceConfirmation(totalDebitCents: number, totalCreditCents: number, locale: ExportLocale) {
  const delta = totalDebitCents - totalCreditCents;
  if (delta === 0) {
    return locale === "fr" ? "OK - débit = crédit" : "OK - debit = credit";
  }

  const amount = formatMoney(Math.abs(delta));

  return locale === "fr" ? `Écart de ${amount}` : `Difference of ${amount}`;
}

function formatExportTimestamp(locale: ExportLocale, value: Date = new Date()) {
  return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function formatPeriodLabel(period: FinancialPeriodSelection | null | undefined, locale: ExportLocale) {
  if (!period) {
    return locale === "fr" ? "Toutes périodes" : "All periods";
  }

  const resolved = resolveFinancialPeriod(period);
  if (period.kind === "month") {
    return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(resolved.startDate);
  }

  if (period.kind === "custom") {
    const endDate = new Date(resolved.endDateExclusive.getTime() - 24 * 60 * 60 * 1000);
    return `${formatEntryDate(resolved.startDate, locale)} - ${formatEntryDate(endDate, locale)}`;
  }

  return resolved.label;
}

function buildPeriodFileToken(period: FinancialPeriodSelection | null | undefined, locale: ExportLocale) {
  if (!period) {
    return locale === "fr" ? "toutes_periodes" : "all_periods";
  }

  const resolved = resolveFinancialPeriod(period);
  if (period.kind === "month") {
    const year = resolved.startDate.getUTCFullYear();
    const month = String(resolved.startDate.getUTCMonth() + 1).padStart(2, "0");
    return `${year}_${month}`;
  }

  if (period.kind === "quarter") {
    const year = resolved.startDate.getUTCFullYear();
    const quarter = Math.floor(resolved.startDate.getUTCMonth() / 3) + 1;
    return locale === "fr" ? `${year}_t${quarter}` : `${year}_q${quarter}`;
  }

  if (period.kind === "year") {
    return String(resolved.startDate.getUTCFullYear());
  }

  const endDate = new Date(resolved.endDateExclusive.getTime() - 24 * 60 * 60 * 1000);
  return `${toIsoDate(resolved.startDate).replace(/-/g, "_")}_${toIsoDate(endDate).replace(/-/g, "_")}`;
}

async function getCompanyFileToken(companyId: string) {
  if (!isValidObjectId(companyId)) {
    return "company";
  }

  const company = await Company.findById(toObjectId(companyId))
    .select("slug name")
    .lean<{ slug?: string | null; name?: string | null } | null>();

  return slugifyFileSegment(company?.slug || company?.name || "company");
}

async function buildExportFileName(params: {
  companyId: string;
  kind: ExportFileKind;
  locale: ExportLocale;
  type: ExportType;
  period?: FinancialPeriodSelection | null;
  format: ExportFormat;
}) {
  const periodToken = buildPeriodFileToken(params.period, params.locale);
  const scopeToken = localizeExportScopeToken(params.type, params.locale);

  if (params.kind === "accountingRows") {
    const companyToken = await getCompanyFileToken(params.companyId);
    const datasetToken = params.type === "all"
      ? localizeExportFileBaseName(params.kind, params.locale)
      : scopeToken;

    return `${companyToken}_${datasetToken}_${periodToken}.${params.format}`;
  }

  const baseToken = localizeExportFileBaseName(params.kind, params.locale);
  const scopedBase = params.type === "all" ? baseToken : `${baseToken}_${scopeToken}`;

  return `${scopedBase}_${periodToken}.${params.format}`;
}

function localizeSheetName(key: "generalLedger" | "purchaseJournal" | "salesJournal" | "vatSummary" | "exportInfo", locale: ExportLocale) {
  if (locale === "fr") {
    switch (key) {
      case "generalLedger":
        return "Grand livre";
      case "purchaseJournal":
        return "Journal achats";
      case "salesJournal":
        return "Journal ventes";
      case "vatSummary":
        return "Résumé TVA";
      case "exportInfo":
      default:
        return "Paramètres export";
    }
  }

  switch (key) {
    case "generalLedger":
      return "General Ledger";
    case "purchaseJournal":
      return "Purchase Journal";
    case "salesJournal":
      return "Sales Journal";
    case "vatSummary":
      return "VAT Summary";
    case "exportInfo":
    default:
      return "Export Info";
  }
}

function sanitizeWorksheetName(name: string, usedNames: Set<string>) {
  const stripped = name.replace(/[\\/?*\[\]:]/g, " ").trim() || "Sheet";
  let candidate = stripped.slice(0, 31);
  let suffix = 2;

  while (usedNames.has(candidate)) {
    const suffixLabel = ` ${suffix}`;
    candidate = `${stripped.slice(0, Math.max(0, 31 - suffixLabel.length))}${suffixLabel}`;
    suffix += 1;
  }

  usedNames.add(candidate);
  return candidate;
}

function buildWorksheetHeaders(rows: ExportRow[], headers?: string[]) {
  if (headers && headers.length > 0) {
    return headers;
  }

  return rows.length > 0 ? Object.keys(rows[0]) : [];
}

function buildWorksheetColumnWidths(headers: string[], rows: ExportRow[]) {
  return headers.map((header) => {
    const widestCell = rows.reduce((maxWidth, row) => {
      const valueWidth = String(row[header] ?? "").length;
      return Math.max(maxWidth, valueWidth);
    }, header.length);

    return { wch: Math.min(48, Math.max(12, widestCell + 2)) };
  });
}

function statusMatchesType(type: ExportType, status?: string | null) {
  if (!status) return undefined;

  if (type === "purchase") {
    return ["paid", "unpaid", "partial"].includes(status) ? status : undefined;
  }

  if (type === "sale") {
    return ["unpaid", "partial_paid", "paid", "overdue"].includes(status) ? status : undefined;
  }

  return status;
}

function buildRange(period?: FinancialPeriodSelection | null) {
  if (!period) {
    return null;
  }

  const resolved = resolveFinancialPeriod(period);
  return {
    startDate: resolved.startDate,
    endDateExclusive: resolved.endDateExclusive,
  };
}

async function getCompanyUserIds(companyId: string) {
  const users = await User.find({ companyId: toObjectId(companyId) })
    .select("_id")
    .lean<Array<{ _id: mongoose.Types.ObjectId }>>();

  return users.map((user) => user._id);
}

function localizeCategoryName(category: {
  name?: string | null;
  nameEn?: string | null;
  nameFr?: string | null;
} | null | undefined, locale: ExportLocale) {
  if (!category) return locale === "fr" ? "Sans catégorie" : "Uncategorized";
  if (locale === "fr") {
    return String(category.nameFr || category.name || category.nameEn || "Sans catégorie");
  }
  return String(category.nameEn || category.name || category.nameFr || "Uncategorized");
}

function localizeSalesCategory(locale: ExportLocale) {
  return locale === "fr" ? "Facture client" : "Sales invoice";
}

function normalizeInvoiceStatus(status: unknown, dueDate: unknown) {
  const normalizedStatus = typeof status === "string" ? status : "unpaid";
  if (normalizedStatus === "paid" || normalizedStatus === "overdue" || normalizedStatus === "partial_paid") {
    return normalizedStatus;
  }

  const due = dueDate ? new Date(String(dueDate)) : null;
  if (due && Number.isFinite(due.getTime()) && normalizedStatus === "unpaid" && due.getTime() < Date.now()) {
    return "overdue";
  }

  return "unpaid";
}

async function loadRawAccountingRows(params: {
  companyId: string;
  locale: ExportLocale;
  type: ExportType;
  status?: string;
  categoryId?: string;
  period?: FinancialPeriodSelection | null;
}): Promise<RepositoryResult<RawAccountingRow[]>> {
  await ConnectDb();

  if (!isValidObjectId(params.companyId)) {
    return { success: false, status: 400, message: "Missing company context" };
  }

  const range = buildRange(params.period);
  const result: RawAccountingRow[] = [];

  if (params.type !== "sale") {
    const purchaseStatus = statusMatchesType("purchase", params.status);
    const expenseQuery: Record<string, unknown> = {
      companyId: toObjectId(params.companyId),
      status: "active",
      archivedAt: null,
      deletedAt: null,
    };

    if (purchaseStatus) {
      expenseQuery.paymentStatus = purchaseStatus;
    }

    if (params.categoryId && isValidObjectId(params.categoryId)) {
      expenseQuery.categoryId = toObjectId(params.categoryId);
    }

    if (range) {
      expenseQuery.expenseDate = {
        $gte: range.startDate,
        $lt: range.endDateExclusive,
      };
    }

    const expenses = await Expense.find(expenseQuery)
      .select("_id expenseDate supplierRef paymentStatus amountExclVatCents vatAmountCents amountInclVatCents supplierId categoryId")
      .populate("supplierId", "fullName companyName")
      .populate("categoryId", "name nameEn nameFr")
      .sort({ expenseDate: 1, createdAt: 1 })
      .limit(MAX_EXPORT_ROWS)
      .lean<Array<{
        _id: mongoose.Types.ObjectId;
        expenseDate?: Date | null;
        supplierRef?: string | null;
        paymentStatus?: string | null;
        amountExclVatCents?: number;
        vatAmountCents?: number;
        amountInclVatCents?: number;
        supplierId?: { fullName?: string; companyName?: string | null } | null;
        categoryId?: { name?: string | null; nameEn?: string | null; nameFr?: string | null } | null;
      }>>();

    for (const expense of expenses) {
      result.push({
        sourceId: String(expense._id),
        type: "purchase",
        date: expense.expenseDate ?? null,
        counterparty: String(expense.supplierId?.fullName || expense.supplierId?.companyName || expense.supplierRef || getUnknownCounterparty("purchase", params.locale)),
        reference: String(expense.supplierRef || expense._id),
        category: localizeCategoryName(expense.categoryId, params.locale),
        status: String(expense.paymentStatus || "unpaid"),
        excludingVatCents: toCents(expense.amountExclVatCents),
        vatCents: toCents(expense.vatAmountCents),
        includingVatCents: toCents(expense.amountInclVatCents),
      });
    }
  }

  if (params.type !== "purchase") {
    const salesStatus = statusMatchesType("sale", params.status);
    const companyUserIds = await getCompanyUserIds(params.companyId);
    const invoiceQuery: Record<string, unknown> = {
      userId: { $in: companyUserIds },
    };

    if (range) {
      invoiceQuery.date = {
        $gte: range.startDate,
        $lt: range.endDateExclusive,
      };
    }

    if (salesStatus) {
      if (salesStatus === "overdue") {
        invoiceQuery.$or = [
          { status: "overdue" },
          {
            status: { $in: ["unpaid", "partial_paid"] },
            dueDate: { $lt: new Date() },
          },
        ];
      } else {
        invoiceQuery.status = salesStatus;
      }
    }

    const invoices = await Invoice.find(invoiceQuery)
      .select("_id invoiceNumber date dueDate status totalExcludingTax totalVat totalIncludingTax clientSnapshot")
      .sort({ date: 1, createdAt: 1 })
      .limit(MAX_EXPORT_ROWS)
      .lean<Array<{
        _id: mongoose.Types.ObjectId;
        invoiceNumber: string;
        date?: Date | null;
        dueDate?: Date | null;
        status?: string | null;
        totalExcludingTax?: number;
        totalVat?: number;
        totalIncludingTax?: number;
        clientSnapshot?: { fullName?: string | null; companyName?: string | null };
      }>>();

    for (const invoice of invoices) {
      result.push({
        sourceId: String(invoice._id),
        type: "sale",
        date: invoice.date ?? null,
        counterparty: String(invoice.clientSnapshot?.companyName || invoice.clientSnapshot?.fullName || getUnknownCounterparty("sale", params.locale)),
        reference: invoice.invoiceNumber,
        category: localizeSalesCategory(params.locale),
        status: normalizeInvoiceStatus(invoice.status, invoice.dueDate),
        excludingVatCents: toCents(invoice.totalExcludingTax),
        vatCents: toCents(invoice.totalVat),
        includingVatCents: toCents(invoice.totalIncludingTax),
      });
    }
  }

  result.sort((left, right) => {
    const leftTime = left.date?.getTime() || 0;
    const rightTime = right.date?.getTime() || 0;
    if (leftTime !== rightTime) {
      return leftTime - rightTime;
    }
    return left.reference.localeCompare(right.reference);
  });

  if (result.length > MAX_EXPORT_ROWS) {
    return { success: false, status: 400, message: `Export exceeds ${MAX_EXPORT_ROWS} rows. Narrow your filters.` };
  }

  return { success: true, data: result };
}

function formatAccountingRows(rows: RawAccountingRow[]): AccountingRow[] {
  return rows.map((row) => ({
    sourceId: row.sourceId,
    type: row.type,
    date: toIsoDate(row.date),
    counterparty: row.counterparty,
    reference: row.reference,
    category: row.category,
    status: row.status,
    excludingVat: formatMoney(row.excludingVatCents),
    vat: formatMoney(row.vatCents),
    includingVat: formatMoney(row.includingVatCents),
  }));
}

function buildAccountingExportRows(rows: AccountingRow[], locale: ExportLocale): ExportRow[] {
  return rows.map((row) => {
    if (locale === "fr") {
      const exportRow: ExportRow = {
        "Source": row.sourceId,
        "Type": localizeTypeLabel(row.type, locale),
        "Date": row.date,
        "Tiers": row.counterparty,
        "Référence": row.reference,
        "Catégorie": row.category,
        "Statut": localizeStatusLabel(row.status, locale),
        "Montant HT": row.excludingVat,
        "TVA": row.vat,
        "Montant TTC": row.includingVat,
      };
      return exportRow;
    }

    const exportRow: ExportRow = {
      "Source": row.sourceId,
      "Type": localizeTypeLabel(row.type, locale),
      "Date": row.date,
      "Counterparty": row.counterparty,
      "Reference": row.reference,
      "Category": row.category,
      "Status": localizeStatusLabel(row.status, locale),
      "Amount excl. VAT": row.excludingVat,
      "VAT": row.vat,
      "Amount incl. VAT": row.includingVat,
    };
    return exportRow;
  });
}

function buildJournalExportRows(rows: RawAccountingRow[], locale: ExportLocale): ExportRow[] {
  return rows.map((row) => {
    const exportRow = {
      date: toIsoDate(row.date),
      reference: row.reference,
      counterparty: row.counterparty,
      category: row.category,
      entryLabel: buildEntryLabel(row, locale),
      status: localizeStatusLabel(row.status, locale),
      excludingVat: formatMoney(row.excludingVatCents),
      vat: formatMoney(row.vatCents),
      includingVat: formatMoney(row.includingVatCents),
    };

    if (locale === "fr") {
      const localizedRow: ExportRow = {
        "Date": exportRow.date,
        "Référence": exportRow.reference,
        "Tiers": exportRow.counterparty,
        "Catégorie": exportRow.category,
        "Libellé écriture": exportRow.entryLabel,
        "Statut": exportRow.status,
        "HT": exportRow.excludingVat,
        "TVA": exportRow.vat,
        "TTC": exportRow.includingVat,
      };
      return localizedRow;
    }

    const localizedRow: ExportRow = {
      "Date": exportRow.date,
      "Reference": exportRow.reference,
      "Counterparty": exportRow.counterparty,
      "Category": exportRow.category,
      "Entry label": exportRow.entryLabel,
      "Status": exportRow.status,
      "Net": exportRow.excludingVat,
      "VAT": exportRow.vat,
      "Gross": exportRow.includingVat,
    };
    return localizedRow;
  });
}

function buildJournalHeaders(locale: ExportLocale) {
  if (locale === "fr") {
    return ["Date", "Référence", "Tiers", "Catégorie", "Libellé écriture", "Statut", "HT", "TVA", "TTC"];
  }

  return ["Date", "Reference", "Counterparty", "Category", "Entry label", "Status", "Net", "VAT", "Gross"];
}

function buildVatSummaryRows(rows: RawAccountingRow[], locale: ExportLocale): VatSummaryRow[] {
  const purchaseRows = rows.filter((row) => row.type === "purchase");
  const salesRows = rows.filter((row) => row.type === "sale");

  const purchaseVat = purchaseRows.reduce((sum, row) => sum + row.vatCents, 0);
  const purchaseEx = purchaseRows.reduce((sum, row) => sum + row.excludingVatCents, 0);
  const purchaseIncl = purchaseRows.reduce((sum, row) => sum + row.includingVatCents, 0);

  const salesVat = salesRows.reduce((sum, row) => sum + row.vatCents, 0);
  const salesEx = salesRows.reduce((sum, row) => sum + row.excludingVatCents, 0);
  const salesIncl = salesRows.reduce((sum, row) => sum + row.includingVatCents, 0);
  const vatDelta = salesVat - purchaseVat;

  return [
    {
      section: locale === "fr" ? "TVA collectée" : "Collected VAT",
      entryCount: salesRows.length,
      excludingVat: formatMoney(salesEx),
      vat: formatMoney(salesVat),
      includingVat: formatMoney(salesIncl),
    },
    {
      section: locale === "fr" ? "TVA déductible" : "Deductible VAT",
      entryCount: purchaseRows.length,
      excludingVat: formatMoney(purchaseEx),
      vat: formatMoney(purchaseVat),
      includingVat: formatMoney(purchaseIncl),
    },
    {
      section: buildVatBalanceSectionLabel(vatDelta, locale),
      entryCount: rows.length,
      excludingVat: formatMoney(salesEx - purchaseEx),
      vat: formatMoney(vatDelta),
      includingVat: formatMoney(salesIncl - purchaseIncl),
    },
  ];
}

function buildVatSummaryExportRows(rows: VatSummaryRow[], locale: ExportLocale): ExportRow[] {
  return rows.map((row) => {
    if (locale === "fr") {
      const exportRow: ExportRow = {
        "Rubrique": row.section,
        "Nb écritures": row.entryCount,
        "HT": row.excludingVat,
        "TVA": row.vat,
        "TTC": row.includingVat,
      };
      return exportRow;
    }

    const exportRow: ExportRow = {
      "Section": row.section,
      "Entries": row.entryCount,
      "Net": row.excludingVat,
      "VAT": row.vat,
      "Gross": row.includingVat,
    };
    return exportRow;
  });
}

function buildGeneralLedgerRows(rows: RawAccountingRow[], locale: ExportLocale): GeneralLedgerRow[] {
  const purchaseExpenseLabel = locale === "fr" ? "Charge d'achat" : "Purchase expense";
  const purchaseVatLabel = locale === "fr" ? "TVA deductible" : "Input VAT";
  const supplierPayableLabel = locale === "fr" ? "Dettes fournisseurs" : "Accounts payable";
  const receivableLabel = locale === "fr" ? "Clients" : "Accounts receivable";
  const salesRevenueLabel = locale === "fr" ? "Produits de vente" : "Sales revenue";
  const outputVatLabel = locale === "fr" ? "TVA collectée" : "Output VAT";

  const ledgerRows: GeneralLedgerRow[] = [];

  for (const row of rows) {
    const date = toIsoDate(row.date);
    const entryLabel = buildEntryLabel(row, locale);

    if (row.type === "purchase") {
      ledgerRows.push({
        date,
        type: row.type,
        reference: row.reference,
        counterparty: row.counterparty,
        accountCode: "601",
        accountLabel: purchaseExpenseLabel,
        entryLabel,
        debitCents: row.excludingVatCents,
        creditCents: 0,
        status: row.status,
      });

      if (row.vatCents > 0) {
        ledgerRows.push({
          date,
          type: row.type,
          reference: row.reference,
          counterparty: row.counterparty,
          accountCode: "44566",
          accountLabel: purchaseVatLabel,
          entryLabel,
          debitCents: row.vatCents,
          creditCents: 0,
          status: row.status,
        });
      }

      ledgerRows.push({
        date,
        type: row.type,
        reference: row.reference,
        counterparty: row.counterparty,
        accountCode: "401",
        accountLabel: supplierPayableLabel,
        entryLabel,
        debitCents: 0,
        creditCents: row.includingVatCents,
        status: row.status,
      });
    } else {
      ledgerRows.push({
        date,
        type: row.type,
        reference: row.reference,
        counterparty: row.counterparty,
        accountCode: "411",
        accountLabel: receivableLabel,
        entryLabel,
        debitCents: row.includingVatCents,
        creditCents: 0,
        status: row.status,
      });

      ledgerRows.push({
        date,
        type: row.type,
        reference: row.reference,
        counterparty: row.counterparty,
        accountCode: "706",
        accountLabel: salesRevenueLabel,
        entryLabel,
        debitCents: 0,
        creditCents: row.excludingVatCents,
        status: row.status,
      });

      if (row.vatCents > 0) {
        ledgerRows.push({
          date,
          type: row.type,
          reference: row.reference,
          counterparty: row.counterparty,
          accountCode: "44571",
          accountLabel: outputVatLabel,
          entryLabel,
          debitCents: 0,
          creditCents: row.vatCents,
          status: row.status,
        });
      }
    }
  }

  return ledgerRows;
}

function buildGeneralLedgerExportRows(rows: GeneralLedgerRow[], locale: ExportLocale): ExportRow[] {
  const totalDebitCents = rows.reduce((sum, row) => sum + row.debitCents, 0);
  const totalCreditCents = rows.reduce((sum, row) => sum + row.creditCents, 0);

  const exportRows: ExportRow[] = rows.map((row) => {
    if (locale === "fr") {
      const exportRow: ExportRow = {
        "Date": row.date,
        "Type": localizeTypeLabel(row.type, locale),
        "Référence": row.reference,
        "Tiers": row.counterparty,
        "Compte": row.accountCode,
        "Libellé comptable": row.accountLabel,
        "Libellé écriture": row.entryLabel,
        "Débit": formatMoney(row.debitCents),
        "Crédit": formatMoney(row.creditCents),
        "Statut": localizeStatusLabel(row.status, locale),
        "Confirmation solde": "",
      };
      return exportRow;
    }

    const exportRow: ExportRow = {
      "Date": row.date,
      "Type": localizeTypeLabel(row.type, locale),
      "Reference": row.reference,
      "Counterparty": row.counterparty,
      "Account code": row.accountCode,
      "Account label": row.accountLabel,
      "Entry label": row.entryLabel,
      "Debit": formatMoney(row.debitCents),
      "Credit": formatMoney(row.creditCents),
      "Status": localizeStatusLabel(row.status, locale),
      "Balance confirmation": "",
    };
    return exportRow;
  });

  if (locale === "fr") {
    exportRows.push({
      "Date": "",
      "Type": "",
      "Référence": "",
      "Tiers": "",
      "Compte": "",
      "Libellé comptable": "",
      "Libellé écriture": "Totaux",
      "Débit": formatMoney(totalDebitCents),
      "Crédit": formatMoney(totalCreditCents),
      "Statut": "",
      "Confirmation solde": "",
    });
    exportRows.push({
      "Date": "",
      "Type": "",
      "Référence": "",
      "Tiers": "",
      "Compte": "",
      "Libellé comptable": "",
      "Libellé écriture": "Contrôle équilibre",
      "Débit": "",
      "Crédit": "",
      "Statut": "",
      "Confirmation solde": buildBalanceConfirmation(totalDebitCents, totalCreditCents, locale),
    });
    return exportRows;
  }

  exportRows.push({
    "Date": "",
    "Type": "",
    "Reference": "",
    "Counterparty": "",
    "Account code": "",
    "Account label": "",
    "Entry label": "Totals",
    "Debit": formatMoney(totalDebitCents),
    "Credit": formatMoney(totalCreditCents),
    "Status": "",
    "Balance confirmation": "",
  });
  exportRows.push({
    "Date": "",
    "Type": "",
    "Reference": "",
    "Counterparty": "",
    "Account code": "",
    "Account label": "",
    "Entry label": "Balance check",
    "Debit": "",
    "Credit": "",
    "Status": "",
    "Balance confirmation": buildBalanceConfirmation(totalDebitCents, totalCreditCents, locale),
  });

  return exportRows;
}

function buildExportInfoRows(params: {
  locale: ExportLocale;
  type: ExportType;
  status?: string;
  categoryId?: string;
  period?: FinancialPeriodSelection | null;
  rawRows: RawAccountingRow[];
  ledgerRows: GeneralLedgerRow[];
}) {
  const purchaseCount = params.rawRows.filter((row) => row.type === "purchase").length;
  const salesCount = params.rawRows.filter((row) => row.type === "sale").length;
  const totalDebitCents = params.ledgerRows.reduce((sum, row) => sum + row.debitCents, 0);
  const totalCreditCents = params.ledgerRows.reduce((sum, row) => sum + row.creditCents, 0);
  const categoryLabel = params.type === "sale"
    ? (params.locale === "fr" ? "Non applicable" : "Not applicable")
    : params.categoryId
      ? (() => {
        const matchingCategory = params.rawRows.find((row) => row.type === "purchase")?.category;
        return matchingCategory ? `${matchingCategory} (${params.categoryId})` : params.categoryId;
      })()
      : (params.locale === "fr" ? "Toutes catégories" : "All categories");
  const statusLabel = params.status
    ? localizeStatusLabel(params.status, params.locale)
    : params.locale === "fr"
      ? "Tous statuts"
      : "All statuses";

  const infoEntries = params.locale === "fr"
    ? [
      ["Pack export", "Classeur comptable"],
      ["Généré le", formatExportTimestamp(params.locale)],
      ["Périmètre", localizeExportTypeLabel(params.type, params.locale)],
      ["Période", formatPeriodLabel(params.period, params.locale)],
      ["Filtre statut", statusLabel],
      ["Filtre catégorie", categoryLabel],
      ["Langue", "Français"],
      ["Nb lignes grand livre", String(params.ledgerRows.length)],
      ["Nb écritures achats", String(purchaseCount)],
      ["Nb écritures ventes", String(salesCount)],
      ["Total débit", formatMoney(totalDebitCents)],
      ["Total crédit", formatMoney(totalCreditCents)],
      ["Contrôle équilibre", buildBalanceConfirmation(totalDebitCents, totalCreditCents, params.locale)],
    ]
    : [
      ["Export pack", "Accounting workbook"],
      ["Generated at", formatExportTimestamp(params.locale)],
      ["Scope", localizeExportTypeLabel(params.type, params.locale)],
      ["Period", formatPeriodLabel(params.period, params.locale)],
      ["Status filter", statusLabel],
      ["Category filter", categoryLabel],
      ["Locale", "English"],
      ["Ledger lines", String(params.ledgerRows.length)],
      ["Purchase entries", String(purchaseCount)],
      ["Sales entries", String(salesCount)],
      ["Total debit", formatMoney(totalDebitCents)],
      ["Total credit", formatMoney(totalCreditCents)],
      ["Balance check", buildBalanceConfirmation(totalDebitCents, totalCreditCents, params.locale)],
    ];

  return infoEntries.map(([label, value]) => {
    if (params.locale === "fr") {
      const exportRow: ExportRow = {
        "Paramètre": label,
        "Valeur": value,
      };
      return exportRow;
    }

    const exportRow: ExportRow = {
      "Parameter": label,
      "Value": value,
    };
    return exportRow;
  });
}

function buildCsvBuffer<T extends Record<string, unknown>>(rows: T[]) {
  if (rows.length === 0) {
    return Buffer.from("", "utf-8");
  }

  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];

  for (const row of rows) {
    lines.push(headers.map((header) => escapeCsvCell(row[header])).join(","));
  }

  return Buffer.from(lines.join("\n"), "utf-8");
}

function buildXlsxBuffer<T extends Record<string, unknown>>(sheetName: string, rows: T[]) {
  return buildWorkbookXlsxBuffer([{ name: sheetName, rows }]);
}

function buildWorkbookXlsxBuffer(sheets: WorkbookSheet[]) {
  const workbook = XLSX.utils.book_new();
  const usedNames = new Set<string>();

  for (const sheet of sheets) {
    const headers = buildWorksheetHeaders(sheet.rows, sheet.headers);
    const worksheet = XLSX.utils.json_to_sheet(sheet.rows, headers.length > 0 ? { header: headers } : undefined);

    if (headers.length > 0) {
      worksheet["!cols"] = buildWorksheetColumnWidths(headers, sheet.rows);
      if (worksheet["!ref"]) {
        worksheet["!autofilter"] = { ref: worksheet["!ref"] };
      }
    }

    XLSX.utils.book_append_sheet(workbook, worksheet, sanitizeWorksheetName(sheet.name, usedNames));
  }

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

export async function buildAccountingRowsExport(params: {
  companyId: string;
  locale: ExportLocale;
  type: ExportType;
  format: ExportFormat;
  status?: string;
  categoryId?: string;
  period?: FinancialPeriodSelection | null;
}): Promise<RepositoryResult<{ buffer: Buffer; fileName: string; contentType: string }>> {
  const rowsResult = await loadRawAccountingRows(params);
  if (!rowsResult.success) {
    return rowsResult;
  }

  const rows = buildAccountingExportRows(formatAccountingRows(rowsResult.data), params.locale);
  const fileName = await buildExportFileName({
    companyId: params.companyId,
    kind: "accountingRows",
    locale: params.locale,
    type: params.type,
    period: params.period,
    format: params.format,
  });

  return {
    success: true,
    data: {
      buffer: params.format === "csv"
        ? buildCsvBuffer(rows)
        : buildXlsxBuffer(params.locale === "fr" ? "Écritures" : "Accounting Rows", rows),
      fileName,
      contentType: params.format === "csv"
        ? "text/csv; charset=utf-8"
        : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  };
}

export async function buildVatSummaryExport(params: {
  companyId: string;
  locale: ExportLocale;
  type: ExportType;
  format: ExportFormat;
  status?: string;
  categoryId?: string;
  period?: FinancialPeriodSelection | null;
}): Promise<RepositoryResult<{ buffer: Buffer; fileName: string; contentType: string }>> {
  const rowsResult = await loadRawAccountingRows(params);
  if (!rowsResult.success) {
    return rowsResult;
  }

  const rows = buildVatSummaryExportRows(buildVatSummaryRows(rowsResult.data, params.locale), params.locale);
  const fileName = await buildExportFileName({
    companyId: params.companyId,
    kind: "vatSummary",
    locale: params.locale,
    type: params.type,
    period: params.period,
    format: params.format,
  });

  return {
    success: true,
    data: {
      buffer: params.format === "csv"
        ? buildCsvBuffer(rows)
        : buildXlsxBuffer(params.locale === "fr" ? "Résumé TVA" : "VAT Summary", rows),
      fileName,
      contentType: params.format === "csv"
        ? "text/csv; charset=utf-8"
        : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  };
}

export async function buildGeneralLedgerExport(params: {
  companyId: string;
  locale: ExportLocale;
  type: ExportType;
  format: ExportFormat;
  status?: string;
  categoryId?: string;
  period?: FinancialPeriodSelection | null;
}): Promise<RepositoryResult<{ buffer: Buffer; fileName: string; contentType: string }>> {
  const rowsResult = await loadRawAccountingRows(params);
  if (!rowsResult.success) {
    return rowsResult;
  }

  const rawRows = rowsResult.data;
  const ledgerRows = buildGeneralLedgerRows(rawRows, params.locale);
  const rows = buildGeneralLedgerExportRows(ledgerRows, params.locale);
  const fileName = await buildExportFileName({
    companyId: params.companyId,
    kind: "generalLedger",
    locale: params.locale,
    type: params.type,
    period: params.period,
    format: params.format,
  });

  const workbookSheets: WorkbookSheet[] = [
    {
      name: localizeSheetName("generalLedger", params.locale),
      rows,
    },
    {
      name: localizeSheetName("purchaseJournal", params.locale),
      rows: buildJournalExportRows(rawRows.filter((row) => row.type === "purchase"), params.locale),
      headers: buildJournalHeaders(params.locale),
    },
    {
      name: localizeSheetName("salesJournal", params.locale),
      rows: buildJournalExportRows(rawRows.filter((row) => row.type === "sale"), params.locale),
      headers: buildJournalHeaders(params.locale),
    },
    {
      name: localizeSheetName("vatSummary", params.locale),
      rows: buildVatSummaryExportRows(buildVatSummaryRows(rawRows, params.locale), params.locale),
    },
    {
      name: localizeSheetName("exportInfo", params.locale),
      rows: buildExportInfoRows({
        locale: params.locale,
        type: params.type,
        status: params.status,
        categoryId: params.categoryId,
        period: params.period,
        rawRows,
        ledgerRows,
      }),
      headers: params.locale === "fr" ? ["Paramètre", "Valeur"] : ["Parameter", "Value"],
    },
  ];

  return {
    success: true,
    data: {
      buffer: params.format === "csv"
        ? buildCsvBuffer(rows)
        : buildWorkbookXlsxBuffer(workbookSheets),
      fileName,
      contentType: params.format === "csv"
        ? "text/csv; charset=utf-8"
        : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  };
}

export async function buildPurchaseAttachmentBundleInput(params: {
  companyId: string;
  expenseIds: string[];
}): Promise<RepositoryResult<PurchaseAttachmentBundleInput>> {
  await ConnectDb();

  if (!isValidObjectId(params.companyId)) {
    return { success: false, status: 400, message: "Missing company context" };
  }

  const expenseIds = params.expenseIds.filter((value) => isValidObjectId(value)).slice(0, 50);
  if (expenseIds.length === 0) {
    return { success: false, status: 400, message: "No valid expense ids supplied" };
  }

  const expenses = await Expense.find({
    companyId: toObjectId(params.companyId),
    _id: { $in: expenseIds.map((value) => toObjectId(value)) },
    status: "active",
    archivedAt: null,
    deletedAt: null,
  })
    .select("_id expenseDate supplierId supplierRef")
    .populate("supplierId", "fullName companyName")
    .lean<Array<{
      _id: mongoose.Types.ObjectId;
      expenseDate?: Date | null;
      supplierId?: { fullName?: string; companyName?: string | null } | null;
      supplierRef?: string | null;
    }>>();

  const attachments = await ExpenseAttachment.find({
    companyId: toObjectId(params.companyId),
    expenseId: { $in: expenses.map((expense) => expense._id) },
  })
    .select("expenseId displayName storageKey")
    .sort({ createdAt: 1 })
    .limit(MAX_ATTACHMENT_FILES)
    .lean<Array<{ expenseId: mongoose.Types.ObjectId; displayName?: string; storageKey?: string }>>();

  if (attachments.length === 0) {
    return { success: false, status: 404, message: "No attachments found for the selected purchase invoices" };
  }

  if (attachments.length >= MAX_ATTACHMENT_FILES) {
    return { success: false, status: 400, message: `Attachment bundle exceeds ${MAX_ATTACHMENT_FILES} files. Narrow your selection.` };
  }

  const expenseById = new Map(
    expenses.map((expense) => [
      String(expense._id),
      {
        expenseDate: expense.expenseDate ? toIsoDate(expense.expenseDate) : null,
        supplierName: String(expense.supplierId?.fullName || expense.supplierId?.companyName || expense.supplierRef || "supplier"),
      },
    ])
  );

  return {
    success: true,
    data: {
      files: attachments.map((attachment) => {
        const expense = expenseById.get(String(attachment.expenseId));
        return {
          expenseId: String(attachment.expenseId),
          expenseDate: expense?.expenseDate ?? null,
          supplierName: expense?.supplierName ?? "supplier",
          fileName: String(attachment.displayName || "attachment"),
          storageKey: String(attachment.storageKey || ""),
        };
      }),
    },
  };
}

export async function recordReportAudit(params: {
  companyId: string;
  userId: string;
  action: "exported" | "downloaded";
  entityId: string;
  ipAddress?: string | null;
  details: Record<string, unknown>;
}) {
  return recordAuditLog({
    entityType: "report",
    entityId: params.entityId,
    companyId: params.companyId,
    action: params.action,
    performedBy: params.userId,
    fieldName: "details",
    newValue: params.details,
    ipAddress: params.ipAddress,
    source: "api",
  });
}