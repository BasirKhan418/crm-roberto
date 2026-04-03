import React from 'react';
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

interface InvoicePdfTemplateProps {
  invoiceNumber: string;
  quoteNumber: string;
  clientName: string;
  companyName: string;
  date: Date | string;
  dueDate?: Date | string | null;
  amountIncludingTax: number;
  locale?: 'en' | 'fr';
}

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontSize: 11,
    color: '#0f172a',
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
    paddingBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: 700,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 10,
    color: '#475569',
  },
  section: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  label: {
    color: '#475569',
  },
  value: {
    fontWeight: 600,
  },
  total: {
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: 700,
  },
  totalValue: {
    fontSize: 12,
    fontWeight: 700,
  },
});

function formatDate(value: Date | string | null | undefined, locale: 'en' | 'fr'): string {
  if (!value) {
    return '--';
  }

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return '--';
  }

  return date.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatAmount(cents: number, locale: 'en' | 'fr'): string {
  return new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100);
}

export function InvoicePdfTemplate({
  invoiceNumber,
  quoteNumber,
  clientName,
  companyName,
  date,
  dueDate,
  amountIncludingTax,
  locale = 'en',
}: InvoicePdfTemplateProps) {
  const t = locale === 'fr'
    ? {
        title: 'Facture',
        issuedBy: 'Emise par',
        client: 'Client',
        invoiceNumber: 'Numero facture',
        quoteRef: 'Reference devis',
        date: 'Date',
        dueDate: 'Echeance',
        total: 'Total TTC',
      }
    : {
        title: 'Invoice',
        issuedBy: 'Issued by',
        client: 'Client',
        invoiceNumber: 'Invoice number',
        quoteRef: 'Quote reference',
        date: 'Date',
        dueDate: 'Due date',
        total: 'Total incl. tax',
      };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>{t.title}</Text>
          <Text style={styles.subtitle}>{t.issuedBy}: {companyName || 'CRM'}</Text>
        </View>

        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.label}>{t.client}</Text>
            <Text style={styles.value}>{clientName || '--'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>{t.invoiceNumber}</Text>
            <Text style={styles.value}>{invoiceNumber}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>{t.quoteRef}</Text>
            <Text style={styles.value}>{quoteNumber}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>{t.date}</Text>
            <Text style={styles.value}>{formatDate(date, locale)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>{t.dueDate}</Text>
            <Text style={styles.value}>{formatDate(dueDate, locale)}</Text>
          </View>

          <View style={styles.total}>
            <Text style={styles.totalLabel}>{t.total}</Text>
            <Text style={styles.totalValue}>{formatAmount(amountIncludingTax, locale)}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
