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
  unitPriceExcludingTax: number;
  vatRate: number;
  totalExcludingTax: number;
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
  totalExcludingTax: number;
  totalVat: number;
  totalIncludingTax: number;
  notes?: string | null;
}

interface QuotePdfTemplateProps {
  quote: QuoteData;
  company: CompanyData | null;
}

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#0f172a',
    paddingTop: 40,
    paddingBottom: 56,
    paddingHorizontal: 40,
    backgroundColor: '#ffffff',
  },
  topSection: {
    marginBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 12,
  },
  companyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
  },
  logo: {
    width: 84,
    height: 84,
    objectFit: 'contain',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 6,
  },
  logoPlaceholder: {
    width: 84,
    height: 84,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
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
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#f8fafc',
  },
  quoteTitle: {
    fontSize: 11,
    letterSpacing: 1.5,
    color: '#475569',
    marginBottom: 4,
  },
  quoteNumber: {
    fontSize: 24,
    fontWeight: 700,
    color: '#0b1f5d',
    marginBottom: 6,
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
    marginBottom: 14,
  },
  sectionCompact: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: '#334155',
    marginBottom: 8,
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
    paddingVertical: 5,
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
    minHeight: 26,
    alignItems: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    minHeight: 26,
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
    paddingVertical: 5,
    fontSize: 9,
  },
  colNo: { width: '8%' },
  colDesc: { width: '34%' },
  colQty: { width: '10%' },
  colUnit: { width: '18%' },
  colVat: { width: '10%' },
  colTotal: { width: '20%' },
  right: {
    textAlign: 'right',
  },
  totalsSection: {
    marginTop: 10,
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
    paddingVertical: 7,
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
    padding: 10,
    lineHeight: 1.45,
    fontSize: 9,
    color: '#334155',
    minHeight: 42,
  },
  notesText: {
    lineHeight: 1.4,
  },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 8,
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
  return `${value.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

function formatStatus(status: QuoteStatus): string {
  return status.toUpperCase();
}

function notEmpty(value?: string | null): string {
  return value && value.trim() ? value : '-';
}

export function QuotePdfTemplate({ quote, company }: QuotePdfTemplateProps) {
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
              <Text>{`VAT: ${notEmpty(company?.vatNumber)}`}</Text>
            </View>
          </View>
        </View>

        <View style={styles.identitySection}>
          <Text style={styles.quoteTitle}>QUOTE</Text>
          <Text style={styles.quoteNumber}>{quote.quoteNumber}</Text>
          <View style={styles.identityRow}>
            <View style={styles.identityCol}>
              <Text style={styles.label}>Date</Text>
              <Text style={styles.value}>{formatDate(quote.date)}</Text>
            </View>
            <View style={styles.identityCol}>
              <Text style={styles.label}>Status</Text>
              <Text style={styles.value}>{formatStatus(quote.status)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>Client Info</Text>
          <View style={styles.clientBox}>
            <View style={styles.infoRow}>
              <Text style={styles.infoKey}>Name</Text>
              <Text style={styles.infoValue}>{notEmpty(quote.clientSnapshot.fullName)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoKey}>Company</Text>
              <Text style={styles.infoValue}>{notEmpty(quote.clientSnapshot.companyName)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoKey}>Phone</Text>
              <Text style={styles.infoValue}>{notEmpty(quote.clientSnapshot.phone)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoKey}>Email</Text>
              <Text style={styles.infoValue}>{notEmpty(quote.clientSnapshot.email)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoKey}>Address</Text>
              <Text style={styles.infoValue}>{notEmpty(quote.clientSnapshot.address)}</Text>
            </View>
            <View style={[styles.infoRow, styles.infoRowLast]}>
              <Text style={styles.infoKey}>VAT</Text>
              <Text style={styles.infoValue}>{notEmpty(quote.clientSnapshot.vatNumber)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Line Items</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.cell, styles.colNo]}>#</Text>
              <Text style={[styles.cell, styles.colDesc]}>Description</Text>
              <Text style={[styles.cell, styles.colQty, styles.right]}>Qty</Text>
              <Text style={[styles.cell, styles.colUnit, styles.right]}>Unit excl.</Text>
              <Text style={[styles.cell, styles.colVat, styles.right]}>VAT %</Text>
              <Text style={[styles.cell, styles.colTotal, styles.right]}>Total</Text>
            </View>

            {quote.lineItems.map((item, index) => (
              <View
                key={`${item.name}-${index}`}
                style={[
                  styles.tableRow,
                  ...(index % 2 === 1 ? [styles.rowAlt] : []),
                  ...(index === quote.lineItems.length - 1 ? [styles.rowLast] : []),
                ]}
              >
                <Text style={[styles.cell, styles.colNo]}>{index + 1}</Text>
                <Text style={[styles.cell, styles.colDesc]}>{item.name}</Text>
                <Text style={[styles.cell, styles.colQty, styles.right]}>{item.quantity}</Text>
                <Text style={[styles.cell, styles.colUnit, styles.right]}>{formatPrice(item.unitPriceExcludingTax)}</Text>
                <Text style={[styles.cell, styles.colVat, styles.right]}>{item.vatRate}%</Text>
                <Text style={[styles.cell, styles.colTotal, styles.right]}>{formatPrice(item.totalExcludingTax)}</Text>
              </View>
            ))}
          </View>

          <View style={styles.totalsSection} wrap={false}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total excl. tax</Text>
              <Text style={styles.totalValue}>{formatPrice(quote.totalExcludingTax)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>VAT</Text>
              <Text style={styles.totalValue}>{formatPrice(quote.totalVat)}</Text>
            </View>
            <View style={[styles.totalRow, styles.grandTotal]}>
              <Text style={styles.totalLabel}>Total incl. tax</Text>
              <Text style={styles.totalValue}>{formatPrice(quote.totalIncludingTax)}</Text>
            </View>
          </View>
        </View>

        {quote.notes ? (
          <View style={styles.sectionCompact} wrap={false}>
            <Text style={styles.sectionTitle}>Notes / Conditions</Text>
            <Text style={styles.notesBox}>
              <Text style={styles.notesText}>{quote.notes}</Text>
            </Text>
          </View>
        ) : null}

        <Text style={styles.footer} fixed>
          Quote valid for 30 days. Payment upon receipt of invoice.
        </Text>
      </Page>
    </Document>
  );
}
