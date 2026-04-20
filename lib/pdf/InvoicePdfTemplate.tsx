import { Document, Image, Link, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

import { formatInvoiceDisplayNumber } from '@/lib/i18n/messages';
import { getPaymentMethodLabel, getPaymentTypeLabel } from '@/lib/payments';
import { hasStructuredAddress } from '@/lib/address';
import type { AddressDetails as SharedAddressDetails } from '@/lib/address';

type InvoiceAddressDetails = SharedAddressDetails;

interface InvoiceCompanyData {
  companyName?: string | null;
  ownerName?: string | null;
  address?: string | null;
  streetNumber?: string | null;
  streetName?: string | null;
  postalCode?: string | null;
  city?: string | null;
  country?: string | null;
  phone?: string | null;
  businessEmail?: string | null;
  vatNumber?: string | null;
  rcsNumber?: string | null;
  businessAuthorizationNumber?: string | null;
  matriculeNumber?: string | null;
  iban?: string | null;
  bankName?: string | null;
  legalIdentifier?: string | null;
  logoUrl?: string | null;
}

interface InvoiceLineItem {
  name: string;
  quantity: number;
  baseUnitPriceExcludingTax: number;
  discountPercentage: number;
  discountAmountExcludingTax: number;
  vatRate: number;
  totalExcludingTax: number;
}

interface InvoicePaymentItem {
  amount: number;
  method: string;
  type: 'deposit' | 'full' | 'remaining_balance';
  paidAt?: string | Date | null;
  createdAt?: string | Date | null;
}

interface InvoiceData {
  status?: 'unpaid' | 'partial_paid' | 'paid' | 'overdue' | 'deposit_paid' | 'initial_paid';
  invoiceNumber: string;
  quoteNumber?: string | null;
  date: string | Date;
  dueDate?: string | Date | null;
  clientSnapshot: {
    fullName: string;
    companyName?: string | null;
    address?: string | null;
    addressDetails?: InvoiceAddressDetails | null;
    email?: string | null;
    phone?: string | null;
    vatNumber?: string | null;
  };
  lineItems: InvoiceLineItem[];
  totalExcludingTaxBeforeDiscount: number;
  totalDiscountExcludingTax: number;
  totalExcludingTax: number;
  totalVat: number;
  totalIncludingTax: number;
  lateFeeAmountCents?: number;
  depositPercentage?: number;
  notes?: string | null;
  payments?: InvoicePaymentItem[];
}

interface InvoicePdfTemplateProps {
  invoice: InvoiceData;
  company: InvoiceCompanyData | null;
  paymentUrl?: string | null;
  locale?: 'en' | 'fr';
}

const translations = {
  en: {
    invoice: 'INVOICE',
    date: 'Date',
    dueDate: 'Due date',
    dueInline: 'Due',
    issuerInfo: 'Issuer',
    clientInfo: 'Client',
    name: 'Name',
    company: 'Company',
    phone: 'Phone',
    email: 'Email',
    address: 'Address',
    addressLine1: 'Address line 1',
    addressLine2: 'Address line 2',
    vat: 'VAT',
    rcs: 'RCS',
    businessAuthorization: 'Business auth.',
    matricule: 'Matricule',
    iban: 'IBAN',
    bankName: 'Bank',
    legalIdentifier: 'Legal ID',
    lineItems: 'Services / Products',
    colDesc: 'Description',
    colQty: 'Qty',
    colUnit: 'Unit excl.',
    colDiscount: 'Discount',
    colVat: 'VAT %',
    colTotal: 'Total HT',
    totalExcl: 'Total excl. tax',
    totalDiscount: 'Discount',
    totalNet: 'Total excl. tax (net)',
    totalVat: 'VAT',
    lateFees: 'Late fees',
    totalIncl: 'Total incl. tax',
    paymentSummary: 'Payment summary',
    paymentStatus: 'Payment status',
    totalInvoiceAmount: 'Total invoice amount',
    statusUnpaid: 'Unpaid',
    statusDepositPaid: 'Partially paid',
    statusPaid: 'Paid',
    statusOverdue: 'Overdue',
    depositDue: 'Deposit due',
    totalPaid: 'Total paid',
    remaining: 'Remaining',
    paymentLink: 'Online payment link',
    paymentHistory: 'Payment history',
    paymentDate: 'Date',
    paymentMethod: 'Method',
    paymentType: 'Type',
    paymentAmount: 'Amount',
    paymentTypeDeposit: 'Partial',
    paymentTypeFull: 'Full payment',
    paymentTypeRemaining: 'Partial payment',
    notes: 'Notes',
    noLogo: 'NO LOGO',
  },
  fr: {
    invoice: 'FACTURE',
    date: 'Date',
    dueDate: '\u00c9ch\u00e9ance',
    dueInline: '\u00c9ch\u00e9ance',
    issuerInfo: '\u00c9metteur',
    clientInfo: 'Client',
    name: 'Nom',
    company: 'Soci\u00e9t\u00e9',
    phone: 'T\u00e9l\u00e9phone',
    email: 'E-mail',
    address: 'Adresse',
    addressLine1: 'Adresse ligne 1',
    addressLine2: 'Adresse ligne 2',
    vat: 'TVA',
    rcs: 'RCS',
    businessAuthorization: 'Autorisation d\'établissement',
    matricule: 'Matricule',
    iban: 'IBAN',
    bankName: 'Banque',
    legalIdentifier: 'Identifiant légal',
    lineItems: 'Prestations / Produits',
    colDesc: 'Description',
    colQty: 'Qt\u00e9',
    colUnit: 'Unitaire HT',
    colDiscount: 'Remise',
    colVat: 'TVA %',
    colTotal: 'Total HT',
    totalExcl: 'Total HT',
    totalDiscount: 'Remise',
    totalNet: 'Total HT (net)',
    totalVat: 'TVA',
    lateFees: 'Penalites de retard',
    totalIncl: 'Total TTC',
    paymentSummary: 'R\u00e9sum\u00e9 des paiements',
    paymentStatus: 'Statut de paiement',
    totalInvoiceAmount: 'Montant total facture',
    statusUnpaid: 'Impay\u00e9e',
    statusDepositPaid: 'Partiellement pay\u00e9e',
    statusPaid: 'Pay\u00e9e',
    statusOverdue: 'En retard',
    depositDue: 'Acompte \u00e0 payer',
    totalPaid: 'Total pay\u00e9',
    remaining: 'Reste \u00e0 payer',
    paymentLink: 'Lien de paiement en ligne',
    paymentHistory: 'Historique des paiements',
    paymentDate: 'Date',
    paymentMethod: 'M\u00e9thode',
    paymentType: 'Type',
    paymentAmount: 'Montant',
    paymentTypeDeposit: 'Partiel',
    paymentTypeFull: 'Paiement complet',
    paymentTypeRemaining: 'Paiement partiel',
    notes: 'Notes',
    noLogo: 'AUCUN LOGO',
  },
} as const;

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#0f172a',
    paddingTop: 26,
    paddingBottom: 28,
    paddingHorizontal: 34,
    backgroundColor: '#ffffff',
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
    marginBottom: 10,
  },
  logo: {
    width: 68,
    height: 68,
    objectFit: 'contain',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 6,
    padding: 4,
  },
  logoPlaceholder: {
    width: 68,
    height: 68,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    color: '#94a3b8',
    fontSize: 9,
  },
  identityCard: {
    width: '48%',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#f8fafc',
  },
  identityTitle: {
    fontSize: 9,
    letterSpacing: 1.5,
    color: '#475569',
    marginBottom: 2,
  },
  identityNumber: {
    fontSize: 18,
    fontWeight: 700,
    color: '#0b1f5d',
    marginBottom: 4,
  },
  identityMetaRow: {
    flexDirection: 'row',
    gap: 16,
  },
  identityMetaCol: {
    flex: 1,
    gap: 2,
  },
  label: {
    fontSize: 8,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  value: {
    fontSize: 10,
    color: '#0f172a',
  },
  section: {
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: '#334155',
    marginBottom: 6,
  },
  partyRow: {
    flexDirection: 'row',
    gap: 12,
  },
  partyBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 7,
    backgroundColor: '#ffffff',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingVertical: 2.5,
  },
  infoRowLast: {
    borderBottomWidth: 0,
  },
  infoKey: {
    width: '32%',
    color: '#64748b',
    fontSize: 8.5,
  },
  infoValue: {
    width: '68%',
    textAlign: 'right',
    color: '#0f172a',
    fontSize: 9.5,
  },
  infoValueFull: {
    width: '100%',
    textAlign: 'left',
    color: '#0f172a',
    fontSize: 9.5,
  },
  table: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#e2e8f0',
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
    minHeight: 20,
    alignItems: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    minHeight: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  rowAlt: {
    backgroundColor: '#f8fafc',
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  cell: {
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    fontSize: 8.5,
  },
  colDesc: { width: '30%' },
  colQty: { width: '8%' },
  colUnit: { width: '14%' },
  colDiscount: { width: '20%' },
  colVat: { width: '8%' },
  colTotal: { width: '20%' },
  right: {
    textAlign: 'right',
  },
  financialRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  totalsSection: {
    flexBasis: '47%',
    width: '47%',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    overflow: 'hidden',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  grandTotal: {
    backgroundColor: '#eef2ff',
    borderBottomWidth: 0,
  },
  totalLabel: {
    color: '#334155',
    fontSize: 9,
  },
  totalValue: {
    color: '#0f172a',
    fontSize: 10,
    fontWeight: 700,
  },
  paymentBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: '#f8fafc',
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  paymentSummaryStack: {
    marginTop: 2,
    borderWidth: 1,
    borderColor: '#dbe4ef',
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
  },
  paymentSummaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  paymentSummaryItemLast: {
    borderBottomWidth: 0,
  },
  paymentSummaryLabel: {
    fontSize: 9,
    color: '#475569',
  },
  paymentSummaryAmount: {
    fontSize: 10,
    fontWeight: 700,
    color: '#0f172a',
  },
  statusBadge: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontSize: 9,
    fontWeight: 700,
  },
  paymentLink: {
    marginTop: 5,
    color: '#1d4ed8',
    fontSize: 9,
    textDecoration: 'underline',
  },
  paymentHistorySection: {
    marginTop: 8,
  },
  notesSection: {
    marginTop: 8,
  },
  supplementarySection: {
    marginTop: 8,
  },
  paymentHistoryHeader: {
    flexDirection: 'row',
    backgroundColor: '#e9eef5',
    borderWidth: 1,
    borderColor: '#d3dde9',
    borderBottomWidth: 0,
  },
  paymentHistoryRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#d3dde9',
    borderTopWidth: 0,
    backgroundColor: '#ffffff',
  },
  paymentCell: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    fontSize: 8,
  },
  payColDate: { width: '30%' },
  payColMethod: { width: '30%' },
  payColType: { width: '20%' },
  payColAmount: { width: '20%' },
  notesBox: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 8,
    lineHeight: 1.4,
    fontSize: 9,
    color: '#334155',
  },
  notesText: {
    lineHeight: 1.4,
  },
  footer: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 6,
  },
  footerText: {
    fontSize: 8,
    color: '#64748b',
    textAlign: 'center',
  },
  footerLabel: {
    fontWeight: 700,
    color: '#111827',
  },
});

function notEmpty(value?: string | null): string {
  return value && value.trim() ? value : '-';
}

function hasContent(value?: string | null): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function compactValueRows(fields: Array<{ value?: string | null; always?: boolean }>) {
  return fields
    .filter((field) => field.always || hasContent(field.value))
    .map((field) => (field.always ? notEmpty(field.value) : field.value!.trim()));
}

function formatDate(dateValue: string | Date | null | undefined): string {
  if (!dateValue) {
    return '-';
  }

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear());
  return `${day}/${month}/${year}`;
}

/**
 * Splits an address into exactly two display lines:
 *   line1 = street number + street name  (e.g. "15 Rue de l'Industrie")
 *   line2 = postal code + city [+ country]  (e.g. "L-8069 Bertrange Luxembourg")
 *
 * The address stored in DB is expected to use newlines (\n) as the primary
 * separator between logical lines.  A comma is treated as an in-line separator
 * only when there is no newline present at all (legacy single-line format).
 *
 * Rules:
 *  - Split on \n first; if that yields only one part, fall back to splitting on commas.
 *  - First part  → line1  (street number + name, already on the same token)
 *  - Remaining parts joined with a space → line2  (postal code + city + country)
 */
function splitAddressLines(address?: string | null): { line1: string; line2: string } {
  if (!hasContent(address)) {
    return { line1: '-', line2: '-' };
  }

  // Primary split: newline characters
  let parts = address!
    .split('\n')
    .map((p) => p.trim())
    .filter(Boolean);

  // Fallback: comma split only when there are no newlines at all
  if (parts.length <= 1) {
    parts = address!
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
  }

  if (parts.length === 0) {
    return { line1: '-', line2: '-' };
  }

  if (parts.length === 1) {
    return { line1: parts[0], line2: '-' };
  }

  // If the first part looks like a standalone street number (e.g. "15", "15A", "15bis"),
  // merge it with the next part (street name) so they appear on the same line.
  const streetNumberPattern = /^\d+[a-zA-Z]*$/;
  if (parts.length >= 2 && streetNumberPattern.test(parts[0])) {
    return {
      line1: `${parts[0]} ${parts[1]}`,
      line2: parts.length > 2 ? parts.slice(2).join(' ') : '-',
    };
  }

  // line1 = first part (street number + name already together)
  // line2 = all remaining parts joined with a space (postal code + city + country)
  return {
    line1: parts[0],
    line2: parts.slice(1).join(' '),
  };
}

function combineAddressLines(lines: { line1: string; line2: string }): string {
  if (lines.line1 === '-' && lines.line2 === '-') {
    return '-';
  }

  if (lines.line2 === '-') {
    return lines.line1;
  }

  if (lines.line1 === '-') {
    return lines.line2;
  }

  return `${lines.line1}\n${lines.line2}`;
}

/**
 * Formats a structured address (from separate fields) into a combined display string.
 * Line 1: street number + street name
 * Line 2: postal code + city + country
 */
function formatStructuredAddressPdf(details?: InvoiceAddressDetails | null): string {
  if (!hasStructuredAddress(details)) return '-';
  const addressDetails = details!;
  const streetParts = [addressDetails.streetNumber, addressDetails.streetName].map((p) => (p ?? '').trim()).filter(Boolean);
  const line1 = streetParts.join(' ');
  const cityPostal = [addressDetails.postalCode, addressDetails.city].map((p) => (p ?? '').trim()).filter(Boolean).join(' ');
  const country = (addressDetails.country ?? '').trim();
  const line2 = cityPostal && country ? `${cityPostal}, ${country}` : (cityPostal || country);
  const combined = [line1, line2].filter(Boolean).join('\n');
  return combined || '-';
}

/**
 * Returns a formatted address string from either structured fields or a legacy single-string address.
 */
function resolveAddressDisplay(details?: InvoiceAddressDetails | null, legacyAddress?: string | null): string {
  if (hasStructuredAddress(details)) {
    return formatStructuredAddressPdf(details);
  }
  const lines = combineAddressLines(splitAddressLines(legacyAddress));
  return lines;
}

function formatLongDate(dateValue: string | Date | null | undefined, locale: 'en' | 'fr'): string {
  if (!dateValue) {
    return '-';
  }

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return date.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatPrice(cents: number): string {
  const value = (cents || 0) / 100;
  const [intPart, decPart] = value.toFixed(2).split('.');
  const intFormatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${intFormatted},${decPart} €`;
}

function formatDateTime(dateValue: string | Date | null | undefined, locale: 'en' | 'fr'): string {
  if (!dateValue) {
    return '-';
  }

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return date.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function paymentTypeLabel(type: InvoicePaymentItem['type'], locale: 'en' | 'fr') {
  return getPaymentTypeLabel(type, locale);
}

function paymentMethodLabel(method: string, locale: 'en' | 'fr') {
  return getPaymentMethodLabel(method, locale);
}

function getStatusPresentation(
  status: InvoiceData['status'],
  localeText: (typeof translations)['en'] | (typeof translations)['fr']
): { label: string; backgroundColor: string; color: string } {
  if (status === 'partial_paid' || status === 'deposit_paid' || status === 'initial_paid') {
    return {
      label: localeText.statusDepositPaid,
      backgroundColor: 'rgba(217, 119, 6, 0.15)',
      color: '#b45309',
    };
  }

  if (status === 'paid') {
    return {
      label: localeText.statusPaid,
      backgroundColor: 'rgba(34, 197, 94, 0.12)',
      color: '#15803d',
    };
  }

  if (status === 'overdue') {
    return {
      label: localeText.statusOverdue,
      backgroundColor: 'rgba(239, 68, 68, 0.16)',
      color: '#b91c1c',
    };
  }

  return {
    label: localeText.statusUnpaid,
    backgroundColor: 'rgba(100, 116, 139, 0.11)',
    color: '#475569',
  };
}

export function InvoicePdfTemplate({ invoice, company, paymentUrl = null, locale = 'en' }: InvoicePdfTemplateProps) {
  const t = translations[locale];
  const displayInvoiceNumber = formatInvoiceDisplayNumber(locale, invoice.invoiceNumber);
  const payments = invoice.payments ?? [];
  const lateFeeAmount = Math.max(0, Math.round(invoice.lateFeeAmountCents ?? 0));
  const grandTotalWithLateFees = invoice.totalIncludingTax + lateFeeAmount;
  const totalPaidAmount = payments.reduce((sum, payment) => sum + Math.max(0, Math.round(payment.amount || 0)), 0);
  const remainingAmount = Math.max(0, grandTotalWithLateFees - totalPaidAmount);
  const statusPresentation = getStatusPresentation(invoice.status, t);
  const issuerAddressDetails = company
    ? { streetNumber: company.streetNumber, streetName: company.streetName, postalCode: company.postalCode, city: company.city, country: company.country }
    : null;
  const issuerAddress = resolveAddressDisplay(issuerAddressDetails, company?.address);
  const clientAddress = resolveAddressDisplay(
    invoice.clientSnapshot.addressDetails,
    invoice.clientSnapshot.address
  );
  const issuerRows = compactValueRows([
    { value: company?.companyName || company?.ownerName, always: true },
    { value: issuerAddress, always: true },
    { value: company?.phone, always: true },
    { value: company?.businessEmail, always: true },
    { value: company?.bankName, always: true },
    { value: company?.iban, always: true },
  ]);
  const clientRows = compactValueRows([
    { value: invoice.clientSnapshot.fullName, always: true },
    { value: clientAddress, always: true },
    { value: invoice.clientSnapshot.phone },
    { value: invoice.clientSnapshot.email },
  ]);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.topHeader}>
          {company?.logoUrl ? (
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image style={styles.logo} src={company.logoUrl} />
          ) : (
            <View style={styles.logoPlaceholder}>
              <Text>{t.noLogo}</Text>
            </View>
          )}

          <View style={styles.identityCard}>
            <Text style={styles.identityTitle}>{t.invoice}</Text>
            <Text style={styles.identityNumber}>{displayInvoiceNumber}</Text>
            <View style={styles.identityMetaRow}>
              <View style={styles.identityMetaCol}>
                <Text style={styles.label}>{t.date}</Text>
                <Text style={styles.value}>{formatDate(invoice.date)}</Text>
              </View>
              <View style={styles.identityMetaCol}>
                <Text style={styles.label}>{t.dueDate}</Text>
                <Text style={styles.value}>{invoice.dueDate ? formatLongDate(invoice.dueDate, locale) : '-'}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section} wrap={false}>
          <View style={styles.partyRow}>
            <View style={styles.partyBox}>
              <Text style={styles.sectionTitle}>{t.issuerInfo}</Text>
              {issuerRows.map((row, index) => (
                <View
                  key={`issuer-${index}`}
                  style={index === issuerRows.length - 1 ? [styles.infoRow, styles.infoRowLast] : styles.infoRow}
                >
                  <Text style={styles.infoValueFull}>{row}</Text>
                </View>
              ))}
            </View>

            <View style={styles.partyBox}>
              <Text style={styles.sectionTitle}>{t.clientInfo}</Text>
              {clientRows.map((row, index) => (
                <View
                  key={`client-${index}`}
                  style={index === clientRows.length - 1 ? [styles.infoRow, styles.infoRowLast] : styles.infoRow}
                >
                  <Text style={styles.infoValueFull}>{row}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.lineItems}</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader} fixed>
              <Text style={[styles.cell, styles.colDesc]}>{t.colDesc}</Text>
              <Text style={[styles.cell, styles.colQty, styles.right]}>{t.colQty}</Text>
              <Text style={[styles.cell, styles.colUnit, styles.right]}>{t.colUnit}</Text>
              <Text style={[styles.cell, styles.colDiscount, styles.right]}>{t.colDiscount}</Text>
              <Text style={[styles.cell, styles.colVat, styles.right]}>{t.colVat}</Text>
              <Text style={[styles.cell, styles.colTotal, styles.right]}>{t.colTotal}</Text>
            </View>

            {invoice.lineItems.map((item, index) => (
              <View
                key={`${item.name}-${index}`}
                wrap={false}
                style={[
                  styles.tableRow,
                  ...(index % 2 === 1 ? [styles.rowAlt] : []),
                  ...(index === invoice.lineItems.length - 1 ? [styles.rowLast] : []),
                ]}
              >
                <Text style={[styles.cell, styles.colDesc]}>{item.name}</Text>
                <Text style={[styles.cell, styles.colQty, styles.right]}>{item.quantity}</Text>
                <Text style={[styles.cell, styles.colUnit, styles.right]}>{formatPrice(item.baseUnitPriceExcludingTax)}</Text>
                <Text style={[styles.cell, styles.colDiscount, styles.right]}>
                  {item.discountAmountExcludingTax > 0
                    ? `${item.discountPercentage.toFixed(2)}% (- ${formatPrice(item.discountAmountExcludingTax)})`
                    : '-'}
                </Text>
                <Text style={[styles.cell, styles.colVat, styles.right]}>{item.vatRate}%</Text>
                <Text style={[styles.cell, styles.colTotal, styles.right]}>{formatPrice(item.totalExcludingTax)}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.financialRow} wrap={false}>
          <View style={styles.paymentBox}>
            <Text style={styles.sectionTitle}>{t.paymentSummary}</Text>
            <View style={styles.paymentRow}>
              <Text style={styles.value}>{t.paymentStatus}</Text>
              <Text
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor: statusPresentation.backgroundColor,
                    color: statusPresentation.color,
                  },
                ]}
              >
                {statusPresentation.label}
              </Text>
            </View>
            <View style={styles.paymentSummaryStack}>
              <View style={styles.paymentSummaryItem}>
                <Text style={styles.paymentSummaryLabel}>{t.totalInvoiceAmount}</Text>
                <Text style={styles.paymentSummaryAmount}>{formatPrice(invoice.totalIncludingTax)}</Text>
              </View>
              <View style={styles.paymentSummaryItem}>
                <Text style={styles.paymentSummaryLabel}>{t.totalPaid}</Text>
                <Text style={styles.paymentSummaryAmount}>{formatPrice(totalPaidAmount)}</Text>
              </View>
              <View style={[styles.paymentSummaryItem, styles.paymentSummaryItemLast]}>
                <Text style={styles.paymentSummaryLabel}>{t.remaining}</Text>
                <Text style={styles.paymentSummaryAmount}>{formatPrice(remainingAmount)}</Text>
              </View>
            </View>
            {paymentUrl ? <Link src={paymentUrl} style={styles.paymentLink}>{t.paymentLink}</Link> : null}
          </View>

          <View style={styles.totalsSection}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>{t.totalExcl}</Text>
              <Text style={styles.totalValue}>{formatPrice(invoice.totalExcludingTaxBeforeDiscount)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>{t.totalDiscount}</Text>
              <Text style={styles.totalValue}>- {formatPrice(invoice.totalDiscountExcludingTax)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>{t.totalNet}</Text>
              <Text style={styles.totalValue}>{formatPrice(invoice.totalExcludingTax)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>{t.totalVat}</Text>
              <Text style={styles.totalValue}>{formatPrice(invoice.totalVat)}</Text>
            </View>
            {lateFeeAmount > 0 ? (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>{t.lateFees}</Text>
                <Text style={styles.totalValue}>{formatPrice(lateFeeAmount)}</Text>
              </View>
            ) : null}
            <View style={[styles.totalRow, styles.grandTotal]}>
              <Text style={styles.totalLabel}>{t.totalIncl}</Text>
              <Text style={styles.totalValue}>{formatPrice(grandTotalWithLateFees)}</Text>
            </View>
          </View>
        </View>

        {payments.length > 0 ? (
          <View style={styles.supplementarySection}>
            <View style={styles.paymentHistorySection}>
              <Text style={styles.sectionTitle}>{t.paymentHistory}</Text>
              <View style={styles.paymentHistoryHeader}>
                <Text style={[styles.paymentCell, styles.payColDate]}>{t.paymentDate}</Text>
                <Text style={[styles.paymentCell, styles.payColMethod]}>{t.paymentMethod}</Text>
                <Text style={[styles.paymentCell, styles.payColType]}>{t.paymentType}</Text>
                <Text style={[styles.paymentCell, styles.payColAmount, styles.right]}>{t.paymentAmount}</Text>
              </View>
              {payments.map((payment, index) => (
                <View key={`${payment.method}-${payment.amount}-${index}`} style={styles.paymentHistoryRow}>
                  <Text style={[styles.paymentCell, styles.payColDate]}>{formatDateTime(payment.paidAt ?? payment.createdAt, locale)}</Text>
                  <Text style={[styles.paymentCell, styles.payColMethod]}>{payment.method ? paymentMethodLabel(payment.method, locale) : '-'}</Text>
                  <Text style={[styles.paymentCell, styles.payColType]}>{paymentTypeLabel(payment.type, locale)}</Text>
                  <Text style={[styles.paymentCell, styles.payColAmount, styles.right]}>{formatPrice(payment.amount)}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {invoice.notes ? (
          <View style={styles.notesSection} wrap={false}>
            <Text style={styles.sectionTitle}>{t.notes}</Text>
            <Text style={styles.notesBox}>
              <Text style={styles.notesText}>{invoice.notes}</Text>
            </Text>
          </View>
        ) : null}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            <Text style={styles.footerLabel}>{`${t.vat}: `}</Text>
            <Text>{notEmpty(company?.vatNumber)}</Text>
            <Text>{' - '}</Text>
            <Text style={styles.footerLabel}>{`${t.matricule}: `}</Text>
            <Text>{notEmpty(company?.matriculeNumber)}</Text>
            <Text>{' - '}</Text>
            <Text style={styles.footerLabel}>{`${t.rcs}: `}</Text>
            <Text>{notEmpty(company?.rcsNumber)}</Text>
            <Text>{' - '}</Text>
            <Text style={styles.footerLabel}>{`${t.businessAuthorization}: `}</Text>
            <Text>{notEmpty(company?.businessAuthorizationNumber)}</Text>
          </Text>
        </View>
      </Page>
    </Document>
  );
}
