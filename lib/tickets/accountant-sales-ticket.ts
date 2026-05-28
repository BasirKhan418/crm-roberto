export const ACCOUNTANT_SALES_TICKET_REASONS = [
  'payment_clarification',
  'missing_payment_proof',
  'accounting_question',
  'invoice_dispute',
] as const;

export type AccountantSalesTicketReason =
  (typeof ACCOUNTANT_SALES_TICKET_REASONS)[number];