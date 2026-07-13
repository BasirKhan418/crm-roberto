export type AuditLogPresenterLocale = "en" | "fr";

export type AuditLogPresenterInput = {
  entityType?: string | null;
  entityId?: string | null;
  action?: string | null;
  fieldName?: string | null;
  source?: string | null;
  newValue?: unknown;
};

type ReportAuditDetails = {
  reportKey?: string;
  fileType?: string;
  fileName?: string;
  format?: string;
  scope?: string;
  fileCount?: number;
};

const ENTITY_LABELS = {
  en: {
    expense: "expense",
    invoice: "invoice",
    supplier: "supplier",
    user: "user or company setting",
    ticket: "ticket",
    report: "report",
  },
  fr: {
    expense: "dépense",
    invoice: "facture",
    supplier: "fournisseur",
    user: "utilisateur ou réglage entreprise",
    ticket: "ticket",
    report: "rapport",
  },
} as const;

const ACTION_LABELS = {
  en: {
    created: "created",
    updated: "updated",
    deleted: "deleted",
    archived: "archived",
    duplicated: "duplicated",
    status_changed: "changed the status of",
    marked_paid: "marked as paid",
    payment_added: "added a payment to",
    exported: "exported",
    downloaded: "downloaded",
  },
  fr: {
    created: "a créé",
    updated: "a modifié",
    deleted: "a supprimé",
    archived: "a archivé",
    duplicated: "a dupliqué",
    status_changed: "a changé le statut de",
    marked_paid: "a marqué comme réglé",
    payment_added: "a ajouté un paiement à",
    exported: "a exporté",
    downloaded: "a téléchargé",
  },
} as const;

const REPORT_LABELS = {
  en: {
    accounting_rows: "Accounting Rows",
    general_ledger: "General Ledger",
    vat_summary: "VAT Summary",
    purchase_attachments_zip: "Purchase Attachment Bundle",
  },
  fr: {
    accounting_rows: "Écritures comptables",
    general_ledger: "Grand livre",
    vat_summary: "Résumé TVA",
    purchase_attachments_zip: "Archive pièces jointes achats",
  },
} as const;

const SCOPE_LABELS = {
  en: {
    all: "Purchases and sales",
    purchase: "Purchases only",
    sale: "Sales only",
  },
  fr: {
    all: "Achats et ventes",
    purchase: "Achats uniquement",
    sale: "Ventes uniquement",
  },
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseReportAuditDetails(value: unknown): ReportAuditDetails | null {
  if (!isRecord(value)) {
    return null;
  }

  const fileCount = Number(value.fileCount);
  return {
    reportKey: typeof value.reportKey === "string" ? value.reportKey : undefined,
    fileType: typeof value.fileType === "string" ? value.fileType.toUpperCase() : typeof value.format === "string" ? value.format.toUpperCase() : undefined,
    fileName: typeof value.fileName === "string" ? value.fileName : undefined,
    format: typeof value.format === "string" ? value.format : undefined,
    scope: typeof value.type === "string" ? value.type : typeof value.scope === "string" ? value.scope : undefined,
    fileCount: Number.isFinite(fileCount) && fileCount > 0 ? fileCount : undefined,
  };
}

export function getAuditActionLabel(action: string | null | undefined, locale: AuditLogPresenterLocale) {
  return ACTION_LABELS[locale][action as keyof typeof ACTION_LABELS.en] || action || (locale === "fr" ? "a modifié" : "changed");
}

export function getAuditEntityLabel(entityType: string | null | undefined, locale: AuditLogPresenterLocale) {
  return ENTITY_LABELS[locale][entityType as keyof typeof ENTITY_LABELS.en] || entityType || (locale === "fr" ? "élément" : "record");
}

export function getAuditTargetLabel(log: AuditLogPresenterInput, locale: AuditLogPresenterLocale) {
  if (log.entityType === "report") {
    const details = parseReportAuditDetails(log.newValue);
    const reportKey = details?.reportKey || log.entityId || "report";
    return REPORT_LABELS[locale][reportKey as keyof typeof REPORT_LABELS.en] || getAuditEntityLabel(log.entityType, locale);
  }

  return getAuditEntityLabel(log.entityType, locale);
}

export function getAuditDescription(log: AuditLogPresenterInput, locale: AuditLogPresenterLocale) {
  if (log.entityType === "report") {
    const details = parseReportAuditDetails(log.newValue);
    const parts: string[] = [];

    if (details?.fileType) {
      parts.push(`${locale === "fr" ? "Type" : "Type"}: ${details.fileType}`);
    }
    if (details?.fileName) {
      parts.push(`${locale === "fr" ? "Fichier" : "File"}: ${details.fileName}`);
    }
    if (details?.scope && SCOPE_LABELS[locale][details.scope as keyof typeof SCOPE_LABELS.en]) {
      parts.push(`${locale === "fr" ? "Périmètre" : "Scope"}: ${SCOPE_LABELS[locale][details.scope as keyof typeof SCOPE_LABELS.en]}`);
    }
    if (details?.fileCount) {
      parts.push(locale === "fr" ? `${details.fileCount} fichier(s)` : `${details.fileCount} file(s)`);
    }

    if (parts.length > 0) {
      return parts.join(" · ");
    }

    return locale === "fr" ? "Historique de téléchargement enregistré." : "Download history recorded.";
  }

  if (log.fieldName) {
    return locale === "fr" ? `Zone modifiée: ${log.fieldName}` : `Changed area: ${log.fieldName}`;
  }

  return locale === "fr"
    ? `Source: ${log.source || "système"}`
    : `Source: ${log.source || "system"}`;
}

export function getAuditSecondaryBadge(log: AuditLogPresenterInput) {
  if (log.entityType !== "report") {
    return null;
  }

  return parseReportAuditDetails(log.newValue)?.fileType || null;
}