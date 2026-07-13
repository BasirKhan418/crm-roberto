import type { TicketLinkedType, TicketStatus, TicketType } from '@/lib/tickets/constants';

export type TicketLocale = 'en' | 'fr';

const TICKET_STATUS_LABELS: Record<TicketLocale, Record<TicketStatus, string>> = {
  en: {
    open: 'Open',
    waiting: 'Waiting',
    replied: 'Replied',
    resolved: 'Resolved',
    archived: 'Archived',
  },
  fr: {
    open: 'Ouvert',
    waiting: 'En attente',
    replied: 'Répondu',
    resolved: 'Résolu',
    archived: 'Archivé',
  },
};

const TICKET_TYPE_LABELS: Record<TicketLocale, Record<TicketType, string>> = {
  en: {
    accounting: 'Accounting',
    validation: 'Validation',
    document: 'Document',
    dispute: 'Dispute',
  },
  fr: {
    accounting: 'Comptabilité',
    validation: 'Validation',
    document: 'Document',
    dispute: 'Litige',
  },
};

const TICKET_LINKED_TYPE_LABELS: Record<TicketLocale, Record<TicketLinkedType, string>> = {
  en: {
    expense: 'Expense',
    invoice: 'Invoice',
    supplier: 'Supplier',
    client: 'Client',
  },
  fr: {
    expense: 'Dépense',
    invoice: 'Facture',
    supplier: 'Fournisseur',
    client: 'Client',
  },
};

export function getTicketStatusLabel(status: TicketStatus, locale: TicketLocale = 'en') {
  return TICKET_STATUS_LABELS[locale][status];
}

export function getTicketTypeLabel(type: TicketType, locale: TicketLocale = 'en') {
  return TICKET_TYPE_LABELS[locale][type];
}

export function getTicketLinkedTypeLabel(type: TicketLinkedType, locale: TicketLocale = 'en') {
  return TICKET_LINKED_TYPE_LABELS[locale][type];
}