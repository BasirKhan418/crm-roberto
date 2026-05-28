export const ACCOUNTANT_PURCHASE_TICKET_REASONS = [
  'missing_invoice',
  'need_clarification',
  'wrong_vat',
  'need_supporting_document',
] as const;

export type AccountantPurchaseTicketReason =
  (typeof ACCOUNTANT_PURCHASE_TICKET_REASONS)[number];