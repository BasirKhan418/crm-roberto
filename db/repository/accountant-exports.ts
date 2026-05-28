import mongoose from "mongoose";
import * as XLSX from "xlsx";

import ConnectDb from "@/db/connectDb";
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
      return {
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
    }

    return {
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
  });
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
      return {
        "Rubrique": row.section,
        "Nb écritures": row.entryCount,
        "HT": row.excludingVat,
        "TVA": row.vat,
        "TTC": row.includingVat,
      };
    }

    return {
      "Section": row.section,
      "Entries": row.entryCount,
      "Net": row.excludingVat,
      "VAT": row.vat,
      "Gross": row.includingVat,
    };
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

  const exportRows = rows.map((row) => {
    if (locale === "fr") {
      return {
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
    }

    return {
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
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
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
  const fileName = `accounting-rows-${params.type}.${params.format}`;

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
  const fileName = `vat-summary-${params.type}.${params.format}`;

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

  const rows = buildGeneralLedgerExportRows(buildGeneralLedgerRows(rowsResult.data, params.locale), params.locale);
  const fileName = `general-ledger-${params.type}.${params.format}`;

  return {
    success: true,
    data: {
      buffer: params.format === "csv"
        ? buildCsvBuffer(rows)
        : buildXlsxBuffer(params.locale === "fr" ? "Grand livre" : "General Ledger", rows),
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