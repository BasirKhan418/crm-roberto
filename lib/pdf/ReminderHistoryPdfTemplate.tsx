import { Document, Page, StyleSheet, Text, View, renderToBuffer } from '@react-pdf/renderer';
import type { DocumentProps } from '@react-pdf/renderer';
import React from 'react';

export interface ReminderHistoryEntry {
  level: number;
  channel?: 'email' | 'whatsapp' | null;
  status?: 'sent' | 'failed' | 'skipped' | 'paused' | 'resumed' | 'generated' | 'court_sent' | null;
  sentAt?: Date | string | null;
  subject?: string | null;
}

export interface ReminderHistoryPdfProps {
  invoiceNumber: string;
  locale: 'en' | 'fr';
  entries: ReminderHistoryEntry[];
}

const COL_DATE = 88;
const COL_LEVEL = 82;
const COL_CHANNEL = 50;
const COL_STATUS = 50;

const BORDER = '#cbd5e1';
const BORDER_SOFT = '#e2e8f0';
const BG_HEADER = '#f1f5f9';
const TEXT_MAIN = '#0f172a';
const TEXT_MUTED = '#475569';

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: TEXT_MAIN,
    paddingTop: 28,
    paddingBottom: 32,
    paddingHorizontal: 32,
    backgroundColor: '#ffffff',
  },
  titleArea: {
    marginBottom: 16,
  },
  title: {
    fontSize: 14,
    fontWeight: 700,
    color: TEXT_MAIN,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 3,
  },
  reference: {
    fontSize: 9.5,
    color: TEXT_MUTED,
  },
  table: {
    borderWidth: 1,
    borderColor: BORDER,
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: BG_HEADER,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  dataRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER_SOFT,
    minHeight: 18,
  },
  lastDataRow: {
    flexDirection: 'row',
    minHeight: 18,
  },
  cell: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRightWidth: 0.5,
    borderRightColor: BORDER_SOFT,
  },
  lastCell: {
    flex: 1,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  headerText: {
    fontSize: 8,
    fontWeight: 700,
    color: TEXT_MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  cellText: {
    fontSize: 8.5,
    color: TEXT_MAIN,
  },
  emptyRow: {
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  emptyText: {
    fontSize: 9,
    color: TEXT_MUTED,
    fontStyle: 'italic',
  },
  pageNumber: {
    position: 'absolute',
    fontSize: 8,
    bottom: 14,
    right: 32,
    color: TEXT_MUTED,
  },
});

function getLevelLabel(level: number, locale: 'en' | 'fr', status?: ReminderHistoryEntry['status']): string {
  if (status === 'generated' || status === 'court_sent') {
    return locale === 'fr' ? 'Recouvrement judiciaire' : 'Legal recovery';
  }

  if (locale === 'fr') {
    const map: Record<number, string> = {
      1: 'Rappel amical',
      2: 'Rappel ferme',
      3: 'Dernier rappel',
      4: 'Mise en demeure',
    };
    return map[level] ?? String(level);
  }
  const map: Record<number, string> = {
    1: 'Soft reminder',
    2: 'Medium reminder',
    3: 'Firm reminder',
    4: 'Formal notice',
  };
  return map[level] ?? String(level);
}

function getStatusLabel(
  status: ReminderHistoryEntry['status'],
  locale: 'en' | 'fr'
): string {
  const key = status ?? '';
  if (locale === 'fr') {
    const map: Record<string, string> = {
      sent: 'Envoyé',
      failed: 'Échec',
      skipped: 'Ignoré',
      paused: 'En pause',
      resumed: 'Repris',
      generated: 'Généré',
      court_sent: 'Envoyé au tribunal',
    };
    return map[key] ?? key;
  }
  const map: Record<string, string> = {
    sent: 'Sent',
    failed: 'Failed',
    skipped: 'Skipped',
    paused: 'Paused',
    resumed: 'Resumed',
    generated: 'Generated',
    court_sent: 'Sent to court',
  };
  return map[key] ?? key;
}

function getSubjectLabel(entry: ReminderHistoryEntry, locale: 'en' | 'fr'): string {
  if (entry.subject && entry.subject.trim().length > 0) {
    return entry.subject;
  }

  if (entry.status === 'generated') {
    return locale === 'fr' ? 'Fichier de recouvrement généré' : 'Recovery file generated';
  }

  if (entry.status === 'court_sent') {
    return locale === 'fr' ? 'Dossier envoyé au tribunal' : 'Recovery file sent to court';
  }

  return '';
}

function formatSentAt(
  date: Date | string | null | undefined,
  locale: 'en' | 'fr'
): string {
  if (!date) return '-';
  const parsed = new Date(date);
  if (!Number.isFinite(parsed.getTime())) return '-';
  return new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
    .format(parsed)
    .replace(/[\u00a0\u202f]/g, ' ');
}

export function ReminderHistoryPdfTemplate(props: ReminderHistoryPdfProps) {
  const { locale, invoiceNumber, entries } = props;
  const title = locale === 'fr' ? 'Historique des relances' : 'Reminder history';
  const referenceLabel = locale === 'fr' ? 'Facture' : 'Invoice';
  const colHeaders =
    locale === 'fr'
      ? ['Date', 'Niveau', 'Canal', 'Statut', 'Sujet']
      : ['Date', 'Level', 'Channel', 'Status', 'Subject'];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.titleArea}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.reference}>
            {referenceLabel}: {invoiceNumber}
          </Text>
        </View>

        <View style={styles.table}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={[styles.cell, { width: COL_DATE }]}>
              <Text style={styles.headerText}>{colHeaders[0]}</Text>
            </View>
            <View style={[styles.cell, { width: COL_LEVEL }]}>
              <Text style={styles.headerText}>{colHeaders[1]}</Text>
            </View>
            <View style={[styles.cell, { width: COL_CHANNEL }]}>
              <Text style={styles.headerText}>{colHeaders[2]}</Text>
            </View>
            <View style={[styles.cell, { width: COL_STATUS }]}>
              <Text style={styles.headerText}>{colHeaders[3]}</Text>
            </View>
            <View style={styles.lastCell}>
              <Text style={styles.headerText}>{colHeaders[4]}</Text>
            </View>
          </View>

          {/* Empty state */}
          {entries.length === 0 ? (
            <View style={styles.emptyRow}>
              <Text style={styles.emptyText}>
                {locale === 'fr'
                  ? 'Aucune relance enregistrée.'
                  : 'No reminders recorded.'}
              </Text>
            </View>
          ) : null}

          {/* Data rows */}
          {entries.map((entry, index) => {
            const isLast = index === entries.length - 1;
            return (
              <View
                key={`row-${index}`}
                style={isLast ? styles.lastDataRow : styles.dataRow}
                wrap={false}
              >
                <View style={[styles.cell, { width: COL_DATE }]}>
                  <Text style={styles.cellText}>
                    {formatSentAt(entry.sentAt, locale)}
                  </Text>
                </View>
                <View style={[styles.cell, { width: COL_LEVEL }]}>
                  <Text style={styles.cellText}>
                    {getLevelLabel(entry.level, locale, entry.status)}
                  </Text>
                </View>
                <View style={[styles.cell, { width: COL_CHANNEL }]}>
                  <Text style={styles.cellText}>
                    {entry.channel === 'whatsapp'
                      ? 'WhatsApp'
                      : entry.channel === 'email'
                        ? 'Email'
                        : locale === 'fr'
                          ? 'Système'
                          : 'System'}
                  </Text>
                </View>
                <View style={[styles.cell, { width: COL_STATUS }]}>
                  <Text style={styles.cellText}>
                    {getStatusLabel(entry.status, locale)}
                  </Text>
                </View>
                <View style={styles.lastCell}>
                  <Text style={styles.cellText}>{getSubjectLabel(entry, locale)}</Text>
                </View>
              </View>
            );
          })}
        </View>

        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  );
}

export async function renderReminderHistoryPdf(
  props: ReminderHistoryPdfProps
): Promise<Buffer> {
  const document = React.createElement(
    ReminderHistoryPdfTemplate,
    props
  ) as unknown as React.ReactElement<DocumentProps>;
  return renderToBuffer(document);
}
