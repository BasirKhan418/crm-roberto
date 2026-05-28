export function buildExpenseAttachmentFileUrl(attachmentId: string) {
  return `/api/expenses/attachments/${attachmentId}/file`;
}

export function buildAccountantPurchaseAttachmentFileUrl(attachmentId: string) {
  return `/api/accountant/purchase-invoices/attachments/${attachmentId}/file`;
}

export function buildTicketAttachmentFileUrl(attachmentId: string) {
  return `/api/tickets/attachments/${attachmentId}/file`;
}

export function buildAccountantTicketAttachmentFileUrl(attachmentId: string) {
  return `/api/accountant/tickets/attachments/${attachmentId}/file`;
}

export function buildPrivateStoragePlaceholderUrl(storageKey: string) {
  const normalizedKey = String(storageKey || "")
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `https://private.invalid/${normalizedKey || "file"}`;
}