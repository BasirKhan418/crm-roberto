import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from '@react-pdf/renderer';

type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'refused';

interface CompanyData {
  companyName?: string;
  ownerName?: string;
  address?: string;
  phone?: string;
  businessEmail?: string;
  vatNumber?: string;
  logoUrl?: string | null;
}

interface QuoteLineItem {
  name: string;
  quantity: number;
  baseUnitPriceExcludingTax: number;
  unitPriceExcludingTax: number;
  discountPercentage: number;
  vatRate: number;
  totalExcludingTaxBeforeDiscount: number;
  discountAmountExcludingTax: number;
  totalExcludingTax: number;
  vatAmount: number;
  totalIncludingTax: number;
}

interface QuoteData {
  quoteNumber: string;
  date: string | Date;
  status: QuoteStatus;
  clientSnapshot: {
    fullName: string;
    companyName?: string | null;
    address?: string | null;
    email?: string | null;
    phone?: string | null;
    vatNumber?: string | null;
  };
  lineItems: QuoteLineItem[];
  totalExcludingTaxBeforeDiscount: number;
  totalDiscountExcludingTax: number;
  totalExcludingTax: number;
  totalVat: number;
  totalIncludingTax: number;
  notes?: string | null;
  paymentTerms?: string | null;
  validityDays?: number;
}

interface QuotePdfTemplateProps {
  quote: QuoteData;
  company: CompanyData | null;
  locale?: 'en' | 'fr';
}

const translations = {
  en: {
    quote: 'QUOTE',
    date: 'Date',
    status: 'Status',
    clientInfo: 'Client Info',
    name: 'Name',
    company: 'Company',
    phone: 'Phone',
    email: 'Email',
    address: 'Address',
    vat: 'VAT',
    lineItems: 'Line Items',
    colDesc: 'Description',
    colQty: 'Qty',
    colUnit: 'Unit excl.',
    colVat: 'VAT %',
    colTotal: 'Total HT (net)',
    discount: 'Discount',
    totalNet: 'Total excl. tax (net)',
    totalExcl: 'Total excl. tax',
    totalVat: 'VAT',
    totalIncl: 'Total incl. tax',
    notes: 'Notes / Conditions',
    signatureTitle: 'BON POUR ACCORD / CLIENT SIGNATURE',
    companyRep: 'Company representative',
    clientLabel: 'Client - Read and approved',
    dateLabel: 'Date :',
    sigStamp: 'Signature & stamp',
    sig: 'Signature',
    tncText1: 'By signing this document, the client acknowledges having read and accepted the',
    tncLink: 'general terms and conditions (T&C)',
    tncText2: 'in force.',
    footer: 'Quote valid for 30 days. Payment upon receipt of invoice.',
    footerValidity: 'Quote valid for',
    footerDays: 'days.',
    footerPayment: 'Payment:',
    vatPrefix: 'VAT:',
    statusDraft: 'DRAFT',
    statusSent: 'SENT',
    statusAccepted: 'ACCEPTED',
    statusRefused: 'REFUSED',
  },
  fr: {
    quote: 'DEVIS',
    date: 'Date',
    status: 'Statut',
    clientInfo: 'Informations client',
    name: 'Nom',
    company: 'Société',
    phone: 'Téléphone',
    email: 'E-mail',
    address: 'Adresse',
    vat: 'TVA',
    lineItems: 'Lignes du devis',
    colDesc: 'Description',
    colQty: 'Qte',
    colUnit: 'Unit. HT',
    colVat: 'TVA %',
    colTotal: 'Total HT (net)',
    discount: 'Remise',
    totalNet: 'Total HT (net)',
    totalExcl: 'Total HT',
    totalVat: 'TVA',
    totalIncl: 'Total TTC',
    notes: 'Notes / Conditions',
    signatureTitle: 'BON POUR ACCORD / SIGNATURE CLIENT',
    companyRep: 'Représentant de la société',
    clientLabel: 'Client - Lu et approuvé',
    dateLabel: 'Date :',
    sigStamp: 'Signature & cachet',
    sig: 'Signature',
    tncText1: 'En signant ce document, le client reconnaît avoir pris connaissance et accepté les',
    tncLink: 'conditions générales de vente (CGV)',
    tncText2: 'en vigueur.',
    footer: 'Devis valable 30 jours. Règlement à réception de la facture.',
    footerValidity: 'Devis valable',
    footerDays: 'jours.',
    footerPayment: 'Règlement :',
    vatPrefix: 'TVA :',
    statusDraft: 'BROUILLON',
    statusSent: 'ENVOYE',
    statusAccepted: 'ACCEPTE',
    statusRefused: 'REFUSE',
  },
} as const;

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#0f172a',
    paddingTop: 32,
    paddingBottom: 48,
    paddingHorizontal: 40,
    backgroundColor: '#ffffff',
  },
  topSection: {
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 10,
  },
  companyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
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
  companyDetails: {
    flex: 1,
    alignItems: 'flex-end',
    gap: 2,
  },
  companyName: {
    fontSize: 16,
    fontWeight: 700,
    marginBottom: 2,
  },
  identitySection: {
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#f8fafc',
  },
  quoteTitle: {
    fontSize: 9,
    letterSpacing: 1.5,
    color: '#475569',
    marginBottom: 2,
  },
  quoteNumber: {
    fontSize: 20,
    fontWeight: 700,
    color: '#0b1f5d',
    marginBottom: 4,
  },
  identityRow: {
    flexDirection: 'row',
    gap: 16,
  },
  identityCol: {
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
    marginBottom: 10,
  },
  sectionCompact: {
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
  clientBox: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#ffffff',
    gap: 0,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingVertical: 3,
    gap: 10,
  },
  infoRowLast: {
    borderBottomWidth: 0,
  },
  infoKey: {
    width: '28%',
    color: '#64748b',
    fontSize: 9,
  },
  infoValue: {
    width: '72%',
    textAlign: 'right',
    color: '#0f172a',
    fontSize: 10,
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
    minHeight: 22,
    alignItems: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    minHeight: 22,
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
    paddingVertical: 3,
    fontSize: 9,
  },
  colDesc: { width: '28%' },
  colQty: { width: '8%' },
  colUnit: { width: '14%' },
  colDiscount: { width: '20%' },
  colVat: { width: '9%' },
  colTotal: { width: '21%' },
  right: {
    textAlign: 'right',
  },
  totalsSection: {
    marginTop: 8,
    alignSelf: 'flex-end',
    width: '46%',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    overflow: 'hidden',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 5,
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
  signatureSection: {
    marginTop: 12,
    marginBottom: 8,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 10,
  },
  signatureTitle: {
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: '#334155',
    marginBottom: 8,
  },
  signatureRow: {
    flexDirection: 'row',
    gap: 12,
  },
  signatureCol: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: '#f8fafc',
  },
  signatureColLabel: {
    fontSize: 7.5,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 5,
  },
  signatureDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 5,
  },
  signatureDateLabel: {
    fontSize: 8.5,
    color: '#475569',
  },
  signatureDateLine: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: '#94a3b8',
    borderStyle: 'dashed',
    height: 10,
  },
  signatureBox: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 4,
    borderStyle: 'dashed',
    height: 38,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    paddingHorizontal: 5,
    paddingBottom: 3,
  },
  signatureBoxHint: {
    fontSize: 7,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  tncRow: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 3,
  },
  tncText: {
    fontSize: 7.5,
    color: '#64748b',
  },
  tncLink: {
    fontSize: 7.5,
    color: '#3b82f6',
    textDecoration: 'underline',
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 6,
    fontSize: 7.5,
    color: '#64748b',
    textAlign: 'center',
  },
});

function formatDate(dateValue: string | Date): string {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear());
  return `${day}/${month}/${year}`;
}

function formatPrice(cents: number): string {
  const value = (cents || 0) / 100;
  const [intPart, decPart] = value.toFixed(2).split('.');
  // Manual thousands separator using a plain space (avoids U+202F rendering as '/' in PDF)
  const intFormatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${intFormatted},${decPart} €`;
}

function formatStatus(status: QuoteStatus, t: (typeof translations)[keyof typeof translations]): string {
  const map: Record<QuoteStatus, string> = {
    draft: t.statusDraft,
    sent: t.statusSent,
    accepted: t.statusAccepted,
    refused: t.statusRefused,
  };
  return map[status];
}

function notEmpty(value?: string | null): string {
  return value && value.trim() ? value : '-';
}

export function QuotePdfTemplate({ quote, company, locale = 'en' }: QuotePdfTemplateProps) {
  const t = translations[locale];
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.topSection}>
          <View style={styles.companyHeader}>
            {company?.logoUrl ? (
              <Image style={styles.logo} src={company.logoUrl} />
            ) : (
              <View style={styles.logoPlaceholder}>
                <Text>NO LOGO</Text>
              </View>
            )}

            <View style={styles.companyDetails}>
              <Text style={styles.companyName}>{notEmpty(company?.companyName)}</Text>
              <Text>{notEmpty(company?.address)}</Text>
              <Text>{notEmpty(company?.phone)}</Text>
              <Text>{notEmpty(company?.businessEmail)}</Text>
              <Text>{`${t.vatPrefix} ${notEmpty(company?.vatNumber)}`}</Text>
            </View>
          </View>
        </View>

        <View style={styles.identitySection}>
          <Text style={styles.quoteTitle}>{t.quote}</Text>
          <Text style={styles.quoteNumber}>{quote.quoteNumber}</Text>
          <View style={styles.identityRow}>
            <View style={styles.identityCol}>
              <Text style={styles.label}>{t.date}</Text>
              <Text style={styles.value}>{formatDate(quote.date)}</Text>
            </View>
            <View style={styles.identityCol}>
              <Text style={styles.label}>{t.status}</Text>
              <Text style={styles.value}>{formatStatus(quote.status, t)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>{t.clientInfo}</Text>
          <View style={styles.clientBox}>
            <View style={styles.infoRow}>
              <Text style={styles.infoKey}>{t.name}</Text>
              <Text style={styles.infoValue}>{notEmpty(quote.clientSnapshot.fullName)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoKey}>{t.company}</Text>
              <Text style={styles.infoValue}>{notEmpty(quote.clientSnapshot.companyName)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoKey}>{t.phone}</Text>
              <Text style={styles.infoValue}>{notEmpty(quote.clientSnapshot.phone)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoKey}>{t.email}</Text>
              <Text style={styles.infoValue}>{notEmpty(quote.clientSnapshot.email)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoKey}>{t.address}</Text>
              <Text style={styles.infoValue}>{notEmpty(quote.clientSnapshot.address)}</Text>
            </View>
            <View style={[styles.infoRow, styles.infoRowLast]}>
              <Text style={styles.infoKey}>{t.vat}</Text>
              <Text style={styles.infoValue}>{notEmpty(quote.clientSnapshot.vatNumber)}</Text>
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
              <Text style={[styles.cell, styles.colDiscount, styles.right]}>{t.discount}</Text>
              <Text style={[styles.cell, styles.colVat, styles.right]}>{t.colVat}</Text>
              <Text style={[styles.cell, styles.colTotal, styles.right]}>{t.colTotal}</Text>
            </View>

            {quote.lineItems.map((item, index) => (
              <View
                key={`${item.name}-${index}`}
                wrap={false}
                style={[
                  styles.tableRow,
                  ...(index % 2 === 1 ? [styles.rowAlt] : []),
                  ...(index === quote.lineItems.length - 1 ? [styles.rowLast] : []),
                ]}
              >
                <Text style={[styles.cell, styles.colDesc]}>
                  {item.name}
                </Text>
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

        <View style={styles.totalsSection} wrap={false}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{t.totalExcl}</Text>
            <Text style={styles.totalValue}>{formatPrice(quote.totalExcludingTaxBeforeDiscount)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{t.discount}</Text>
            <Text style={styles.totalValue}>- {formatPrice(quote.totalDiscountExcludingTax)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{t.totalNet}</Text>
            <Text style={styles.totalValue}>{formatPrice(quote.totalExcludingTax)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{t.totalVat}</Text>
            <Text style={styles.totalValue}>{formatPrice(quote.totalVat)}</Text>
          </View>
          <View style={[styles.totalRow, styles.grandTotal]}>
            <Text style={styles.totalLabel}>{t.totalIncl}</Text>
            <Text style={styles.totalValue}>{formatPrice(quote.totalIncludingTax)}</Text>
          </View>
        </View>

        {quote.notes ? (
          <View style={styles.sectionCompact} wrap={false}>
            <Text style={styles.sectionTitle}>{t.notes}</Text>
            <Text style={styles.notesBox}>
              <Text style={styles.notesText}>{quote.notes}</Text>
            </Text>
          </View>
        ) : null}

        {/* Signature area */}
        <View style={styles.signatureSection} wrap={false}>
          <Text style={styles.signatureTitle}>{t.signatureTitle}</Text>
          <View style={styles.signatureRow}>
            {/* Company signature */}
            <View style={styles.signatureCol}>
              <Text style={styles.signatureColLabel}>{t.companyRep}</Text>
              <View style={styles.signatureDateRow}>
                <Text style={styles.signatureDateLabel}>{t.dateLabel}</Text>
                <View style={styles.signatureDateLine} />
              </View>
              <View style={styles.signatureBox}>
                <Text style={styles.signatureBoxHint}>{t.sigStamp}</Text>
              </View>
            </View>

            {/* Client signature */}
            <View style={styles.signatureCol}>
              <Text style={styles.signatureColLabel}>{t.clientLabel}</Text>
              <View style={styles.signatureDateRow}>
                <Text style={styles.signatureDateLabel}>{t.dateLabel}</Text>
                <View style={styles.signatureDateLine} />
              </View>
              <View style={styles.signatureBox}>
                <Text style={styles.signatureBoxHint}>{t.sig}</Text>
              </View>
            </View>
          </View>

          <View style={styles.tncRow}>
            <Text style={styles.tncText}>{t.tncText1}</Text>
            <Text style={styles.tncLink}>{t.tncLink}</Text>
            <Text style={styles.tncText}>{t.tncText2}</Text>
          </View>
        </View>

        <Text style={styles.footer} fixed>{
          (() => {
            const validity = quote.validityDays ?? 30;
            const validityPart = `${t.footerValidity} ${validity} ${t.footerDays}`;
            const paymentPart = quote.paymentTerms ? ` ${t.footerPayment} ${quote.paymentTerms}` : '';
            return `${validityPart}${paymentPart}`;
          })()
        }</Text>
      </Page>
    </Document>
  );
}
