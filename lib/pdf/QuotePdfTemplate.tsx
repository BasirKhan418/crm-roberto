import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from '@react-pdf/renderer';

type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'refused' | 'rejected';

interface CompanyData {
  companyName?: string;
  ownerName?: string;
  address?: string;
  phone?: string;
  businessEmail?: string;
  vatNumber?: string;
  rcsNumber?: string | null;
  businessAuthorizationNumber?: string | null;
  matriculeNumber?: string | null;
  iban?: string | null;
  bankName?: string | null;
  legalIdentifier?: string | null;
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
  signedStatus?: 'not_signed' | 'signed';
  signedAt?: string | Date | null;
  signatureDataUrl?: string | null;
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
    agreementTitle: 'GOOD FOR AGREEMENT',
    clientNameLabel: 'Client name:',
    dateLabel: 'Date:',
    signatureLabel: 'Signature',
    tncText1: 'By signing this quote, the client acknowledges having read and accepted the',
    tncLink: 'general terms and conditions (T&C)',
    tncText2: 'in force.',
    footerValidity: 'Quote valid for',
    footerDays: 'days.',
    vatPrefix: 'VAT:',
    statusDraft: 'DRAFT',
    statusSent: 'SENT',
    statusAccepted: 'ACCEPTED',
    statusRefused: 'REFUSED',
    statusRejected: 'REJECTED',
  },
  fr: {
    quote: 'DEVIS',
    date: 'Date',
    status: 'Statut',
    issuerInfo: '\u00c9metteur',
    clientInfo: 'Client',
    name: 'Nom',
    company: 'Soci\u00e9t\u00e9',
    phone: 'T\u00e9l\u00e9phone',
    email: 'E-mail',
    address: 'Adresse',
    vat: 'TVA',
    rcs: 'RCS',
    businessAuthorization: 'Autorisation',
    matricule: 'Matricule',
    iban: 'IBAN',
    bankName: 'Banque',
    legalIdentifier: 'ID legal',
    lineItems: 'Lignes du devis',
    colDesc: 'Description',
    colQty: 'Qt\u00e9',
    colUnit: 'Unit. HT',
    colVat: 'TVA %',
    colTotal: 'Total HT (net)',
    discount: 'Remise',
    totalNet: 'Total HT (net)',
    totalExcl: 'Total HT',
    totalVat: 'TVA',
    totalIncl: 'Total TTC',
    notes: 'Notes / Conditions',
    agreementTitle: 'BON POUR ACCORD',
    clientNameLabel: 'Nom du client\u00a0:',
    dateLabel: 'Date\u00a0:',
    signatureLabel: 'Signature',
    tncText1: 'En signant ce devis, le client reconna\u00eet accepter les',
    tncLink: 'conditions g\u00e9n\u00e9rales de vente (CGV)',
    tncText2: 'en vigueur.',
    footerValidity: 'Devis valable',
    footerDays: 'jours.',
    vatPrefix: 'TVA\u00a0:',
    statusDraft: 'BROUILLON',
    statusSent: 'ENVOY\u00c9',
    statusAccepted: 'ACCEPT\u00c9',
    statusRefused: 'REFUS\u00c9',
    statusRejected: 'REFUS\u00c9 (CLIENT)',
  },
} as const;

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#0f172a',
    paddingTop: 32,
    paddingBottom: 36,
    paddingHorizontal: 40,
    backgroundColor: '#ffffff',
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
    marginBottom: 12,
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
  quoteIdentityCard: {
    width: '48%',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
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
    marginBottom: 6,
  },
  quoteMetaRow: {
    flexDirection: 'row',
    gap: 16,
  },
  quoteMetaCol: {
    flex: 1,
    gap: 2,
  },
  partySection: {
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 10,
  },
  partyRow: {
    flexDirection: 'row',
    gap: 12,
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
  partyBox: {
    flex: 1,
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
  agreementSection: {
    marginTop: 12,
    marginBottom: 0,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 10,
  },
  agreementTitle: {
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: '#334155',
    marginBottom: 8,
  },
  agreementBox: {
    width: '55%',
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: '#ffffff',
  },
  agreementLabel: {
    fontSize: 8,
    color: '#64748b',
    marginBottom: 0,
  },
  agreementLabelClient: {
    color: '#dc2626',
  },
  agreementInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  agreementInlineLine: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
    borderStyle: 'dashed',
    height: 8,
  },
  agreementInlineValue: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
    borderStyle: 'dashed',
    minHeight: 10,
    fontSize: 9,
    color: '#0f172a',
    textAlign: 'left',
    paddingTop: 1,
  },
  signatureBox: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 4,
    borderStyle: 'dashed',
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 0,
  },
  signatureImage: {
    width: '92%',
    height: 30,
    objectFit: 'contain',
  },
  signatureBoxHint: {
    fontSize: 8,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  tncRow: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 3,
  },
  tncText: {
    fontSize: 8,
    color: '#dc2626',
  },
  tncLink: {
    fontSize: 8,
    color: '#dc2626',
    textDecoration: 'none',
  },
  footer: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 6,
    fontSize: 8,
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
    rejected: t.statusRejected,
  };
  return map[status];
}

function notEmpty(value?: string | null): string {
  return value && value.trim() ? value : '-';
}

export function QuotePdfTemplate({ quote, company, locale = 'en' }: QuotePdfTemplateProps) {
  const t = translations[locale];
  const isSigned = quote.signedStatus === 'signed';
  const signedClientName = isSigned ? notEmpty(quote.clientSnapshot.fullName) : '';
  const signedDate = isSigned && quote.signedAt ? formatDate(quote.signedAt) : '';
  const signatureDataUrl = isSigned ? quote.signatureDataUrl ?? null : null;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.topHeader}>
          {company?.logoUrl ? (
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image style={styles.logo} src={company.logoUrl} />
          ) : (
            <View style={styles.logoPlaceholder}>
              <Text>NO LOGO</Text>
            </View>
          )}

          <View style={styles.quoteIdentityCard}>
            <Text style={styles.quoteTitle}>{t.quote}</Text>
            <Text style={styles.quoteNumber}>{quote.quoteNumber}</Text>
            <View style={styles.quoteMetaRow}>
              <View style={styles.quoteMetaCol}>
                <Text style={styles.label}>{t.date}</Text>
                <Text style={styles.value}>{formatDate(quote.date)}</Text>
              </View>
              <View style={styles.quoteMetaCol}>
                <Text style={styles.label}>{t.status}</Text>
                <Text style={styles.value}>{formatStatus(quote.status, t)}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.partySection} wrap={false}>
          <View style={styles.partyRow}>
            <View style={styles.partyBox}>
              <Text style={styles.sectionTitle}>{t.issuerInfo}</Text>
              <View style={styles.infoRow}>
                <Text style={styles.infoKey}>{t.company}</Text>
                <Text style={styles.infoValue}>{notEmpty(company?.companyName)}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoKey}>{t.address}</Text>
                <Text style={styles.infoValue}>{notEmpty(company?.address)}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoKey}>{t.phone}</Text>
                <Text style={styles.infoValue}>{notEmpty(company?.phone)}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoKey}>{t.email}</Text>
                <Text style={styles.infoValue}>{notEmpty(company?.businessEmail)}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoKey}>{t.vat}</Text>
                <Text style={styles.infoValue}>{notEmpty(company?.vatNumber)}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoKey}>{t.rcs}</Text>
                <Text style={styles.infoValue}>{notEmpty(company?.rcsNumber)}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoKey}>{t.businessAuthorization}</Text>
                <Text style={styles.infoValue}>{notEmpty(company?.businessAuthorizationNumber)}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoKey}>{t.matricule}</Text>
                <Text style={styles.infoValue}>{notEmpty(company?.matriculeNumber)}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoKey}>{t.iban}</Text>
                <Text style={styles.infoValue}>{notEmpty(company?.iban)}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoKey}>{t.bankName}</Text>
                <Text style={styles.infoValue}>{notEmpty(company?.bankName)}</Text>
              </View>
              <View style={[styles.infoRow, styles.infoRowLast]}>
                <Text style={styles.infoKey}>{t.legalIdentifier}</Text>
                <Text style={styles.infoValue}>{notEmpty(company?.legalIdentifier)}</Text>
              </View>
            </View>

            <View style={styles.partyBox}>
              <Text style={styles.sectionTitle}>{t.clientInfo}</Text>
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

        <View style={styles.agreementSection} wrap={false}>
          <Text style={styles.agreementTitle}>{t.agreementTitle}</Text>
          <View style={styles.agreementBox}>
            <View style={styles.agreementInputRow}>
              <Text style={[styles.agreementLabel, styles.agreementLabelClient]}>{t.clientNameLabel}</Text>
              {signedClientName ? (
                <Text style={styles.agreementInlineValue}>{signedClientName}</Text>
              ) : (
                <View style={styles.agreementInlineLine} />
              )}
            </View>

            <View style={styles.agreementInputRow}>
              <Text style={styles.agreementLabel}>{t.dateLabel}</Text>
              {signedDate ? (
                <Text style={styles.agreementInlineValue}>{signedDate}</Text>
              ) : (
                <View style={styles.agreementInlineLine} />
              )}
            </View>

            <View style={styles.signatureBox}>
              {signatureDataUrl ? (
                // eslint-disable-next-line jsx-a11y/alt-text
                <Image style={styles.signatureImage} src={signatureDataUrl} />
              ) : (
                <Text style={styles.signatureBoxHint}>{t.signatureLabel}</Text>
              )}
            </View>
          </View>

          <View style={styles.tncRow}>
            <Text style={styles.tncText}>{t.tncText1}</Text>
            <Text style={styles.tncLink}>{t.tncLink}</Text>
            <Text style={styles.tncText}>{t.tncText2}</Text>
          </View>
        </View>

        <Text style={styles.footer}>
          {`${t.footerValidity} ${quote.validityDays ?? 30} ${t.footerDays}`}
        </Text>
      </Page>
    </Document>
  );
}
