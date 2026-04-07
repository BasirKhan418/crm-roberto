import { Document, Image, Link, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

import { formatInvoiceDisplayNumber } from '@/lib/i18n/messages';
import { getPaymentMethodLabel, getPaymentTypeLabel } from '@/lib/payments';

interface InvoiceCompanyData {
  companyName?: string | null;
  ownerName?: string | null;
  address?: string | null;
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
    paymentTypeFull: 'Full',
    paymentTypeRemaining: 'Remaining balance',
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
    paymentTypeFull: 'Complet',
    paymentTypeRemaining: 'Solde restant',
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
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingVertical: 2.5,
    gap: 10,
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
});

function notEmpty(value?: string | null): string {
  return value && value.trim() ? value : '-';
}

function hasContent(value?: string | null): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function compactInfoRows(fields: Array<{ label: string; value?: string | null; always?: boolean }>) {
  return fields
    .filter((field) => field.always || hasContent(field.value))
    .map((field) => ({
      label: field.label,
      value: field.always ? notEmpty(field.value) : field.value!.trim(),
    }));
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
  const totalPaidAmount = payments.reduce((sum, payment) => sum + Math.max(0, Math.round(payment.amount || 0)), 0);
  const remainingAmount = Math.max(0, invoice.totalIncludingTax - totalPaidAmount);
  const statusPresentation = getStatusPresentation(invoice.status, t);
  const issuerRows = compactInfoRows([
    { label: t.company, value: company?.companyName || company?.ownerName, always: true },
    { label: t.address, value: company?.address },
    { label: t.phone, value: company?.phone },
    { label: t.email, value: company?.businessEmail },
    { label: t.vat, value: company?.vatNumber },
    { label: t.rcs, value: company?.rcsNumber },
    { label: t.businessAuthorization, value: company?.businessAuthorizationNumber },
    { label: t.matricule, value: company?.matriculeNumber },
    { label: t.iban, value: company?.iban },
    { label: t.bankName, value: company?.bankName },
    { label: t.legalIdentifier, value: company?.legalIdentifier },
  ]);
  const clientRows = compactInfoRows([
    { label: t.name, value: invoice.clientSnapshot.fullName, always: true },
    { label: t.company, value: invoice.clientSnapshot.companyName },
    { label: t.phone, value: invoice.clientSnapshot.phone },
    { label: t.email, value: invoice.clientSnapshot.email },
    { label: t.address, value: invoice.clientSnapshot.address },
    { label: t.vat, value: invoice.clientSnapshot.vatNumber },
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
                  key={`${row.label}-${index}`}
                  style={index === issuerRows.length - 1 ? [styles.infoRow, styles.infoRowLast] : styles.infoRow}
                >
                  <Text style={styles.infoKey}>{row.label}</Text>
                  <Text style={styles.infoValue}>{row.value}</Text>
                </View>
              ))}
            </View>

            <View style={styles.partyBox}>
              <Text style={styles.sectionTitle}>{t.clientInfo}</Text>
              {clientRows.map((row, index) => (
                <View
                  key={`${row.label}-${index}`}
                  style={index === clientRows.length - 1 ? [styles.infoRow, styles.infoRowLast] : styles.infoRow}
                >
                  <Text style={styles.infoKey}>{row.label}</Text>
                  <Text style={styles.infoValue}>{row.value}</Text>
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
            <View style={[styles.totalRow, styles.grandTotal]}>
              <Text style={styles.totalLabel}>{t.totalIncl}</Text>
              <Text style={styles.totalValue}>{formatPrice(invoice.totalIncludingTax)}</Text>
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
      </Page>
    </Document>
  );
}
