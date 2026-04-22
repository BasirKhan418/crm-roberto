import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from '@react-pdf/renderer';
import type { DocumentProps } from '@react-pdf/renderer';
import React from 'react';

export interface LegalNoticeCompanyProfile {
  logo?: string | null;
  name: string;
  ownerName?: string | null;
  address?: string | null;
  vatNumber?: string | null;
  iban?: string | null;
  bankName?: string | null;
}

export interface LegalNoticePdfProps {
  companyProfile: LegalNoticeCompanyProfile;
  clientName: string;
  clientAddress?: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  daysOverdue: number;
  amountDue: string;
  amountOriginal: string;
  lateFees?: string;
  legalDeadline: string;
  legalNoticeDate: string;
  delayDays: 8 | 15;
  includeInterestClause: boolean;
  customFooter?: string;
  locale: 'en' | 'fr';
}

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
  identityCard: {
    width: '62%',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#f8fafc',
  },
  companyName: {
    fontSize: 12,
    fontWeight: 700,
    color: '#0b1f5d',
    marginBottom: 4,
  },
  infoLine: {
    fontSize: 9,
    color: '#334155',
    marginBottom: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: 800,
    color: '#7f1d1d',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  subHeader: {
    fontSize: 9,
    color: '#7f1d1d',
    marginBottom: 8,
  },
  dateBlock: {
    marginBottom: 10,
  },
  dateText: {
    fontSize: 10,
    color: '#334155',
  },
  recipientCard: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#ffffff',
    marginBottom: 12,
  },
  recipientTitle: {
    fontSize: 8,
    color: '#64748b',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  recipientName: {
    fontSize: 11,
    fontWeight: 700,
    color: '#0f172a',
    marginBottom: 2,
  },
  recipientAddress: {
    fontSize: 9,
    color: '#334155',
    lineHeight: 1.45,
  },
  paragraph: {
    fontSize: 10,
    lineHeight: 1.55,
    color: '#0f172a',
    marginBottom: 8,
    textAlign: 'justify',
  },
  amountBox: {
    borderWidth: 1,
    borderColor: '#dbe4ef',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#f8fafc',
    marginBottom: 10,
  },
  amountLine: {
    fontSize: 9.5,
    color: '#334155',
    marginBottom: 2,
  },
  amountStrong: {
    fontWeight: 700,
    color: '#111827',
  },
  signatureBlock: {
    marginTop: 8,
    marginBottom: 8,
  },
  signatureLine: {
    fontSize: 10,
    color: '#0f172a',
    marginBottom: 2,
  },
  footer: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 8,
  },
  footerText: {
    fontSize: 8.5,
    color: '#475569',
    lineHeight: 1.45,
    marginBottom: 4,
  },
  pageNumber: {
    position: 'absolute',
    fontSize: 8,
    bottom: 14,
    right: 34,
    color: '#64748b',
  },
});

function notEmpty(value?: string | null): string {
  return value && value.trim() ? value.trim() : '-';
}

function getBodyParagraphs(props: LegalNoticePdfProps): string[] {
  if (props.locale === 'fr') {
    return [
      `Madame, Monsieur,`,
      `Sauf erreur de notre part, la facture ${props.invoiceNumber}, émise le ${props.invoiceDate} et arrivée à échéance le ${props.dueDate}, demeure impayée à ce jour depuis ${props.daysOverdue} jour(s).`,
      `Le montant initial de cette facture est de ${props.amountOriginal}. Le montant exigible à ce jour est de ${props.amountDue}${props.lateFees ? `, incluant des pénalités de retard de ${props.lateFees}` : ''}.`,
      `Par la présente, nous vous mettons formellement en demeure de régler l'intégralité des sommes dues dans un délai de ${props.delayDays} jours calendaires à compter de la réception de ce courrier, soit au plus tard le ${props.legalDeadline}.`,
      `À défaut de régularisation dans ce délai, nous nous réserverons le droit d'engager toute procédure utile de recouvrement, avec application des frais et intérêts prévus par les dispositions légales en vigueur.`,
    ];
  }

  return [
    `Dear Sir or Madam,`,
    `Unless otherwise advised, invoice ${props.invoiceNumber}, issued on ${props.invoiceDate} and due on ${props.dueDate}, remains unpaid and is now ${props.daysOverdue} day(s) overdue.`,
    `The original amount of the invoice is ${props.amountOriginal}. The amount currently due is ${props.amountDue}${props.lateFees ? `, including late fees of ${props.lateFees}` : ''}.`,
    `By this formal notice, you are required to settle all outstanding sums within ${props.delayDays} calendar days from receipt of this letter, no later than ${props.legalDeadline}.`,
    `Failing payment within this deadline, we reserve the right to initiate all appropriate recovery proceedings, including legal fees and statutory interest where applicable.`,
  ];
}

function getInterestClause(locale: 'en' | 'fr'): string {
  if (locale === 'fr') {
    return "Conformément aux dispositions légales applicables, tout retard de paiement peut donner lieu à l'application d'intérêts de retard ainsi qu'à une indemnité forfaitaire pour frais de recouvrement.";
  }

  return 'In accordance with applicable legal provisions, any delay in payment may result in statutory late interest and a fixed compensation for recovery costs.';
}

function getNoLogoLabel(locale: 'en' | 'fr'): string {
  return locale === 'fr' ? 'AUCUN LOGO' : 'NO LOGO';
}

function getCityFromAddress(address?: string | null): string {
  if (!address) {
    return '';
  }

  const lines = address
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return '';
  }

  const lastLine = lines[lines.length - 1];
  return lastLine;
}

export function LegalNoticePdfTemplate(props: LegalNoticePdfProps) {
  const paragraphs = getBodyParagraphs(props);
  const companyAddress = notEmpty(props.companyProfile.address);
  const cityLine = getCityFromAddress(props.companyProfile.address);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.topHeader}>
          {props.companyProfile.logo ? (
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image style={styles.logo} src={props.companyProfile.logo} />
          ) : (
            <View style={styles.logoPlaceholder}>
              <Text>{getNoLogoLabel(props.locale)}</Text>
            </View>
          )}

          <View style={styles.identityCard}>
            <Text style={styles.companyName}>{notEmpty(props.companyProfile.name)}</Text>
            <Text style={styles.infoLine}>{companyAddress}</Text>
            {props.companyProfile.vatNumber ? <Text style={styles.infoLine}>VAT: {props.companyProfile.vatNumber}</Text> : null}
            {props.companyProfile.bankName ? <Text style={styles.infoLine}>Bank: {props.companyProfile.bankName}</Text> : null}
            {props.companyProfile.iban ? <Text style={styles.infoLine}>IBAN: {props.companyProfile.iban}</Text> : null}
          </View>
        </View>

        <Text style={styles.title}>{props.locale === 'fr' ? 'MISE EN DEMEURE' : 'FORMAL NOTICE'}</Text>
        {props.locale === 'fr' ? (
          <Text style={styles.subHeader}>Par lettre recommandée avec accusé de réception</Text>
        ) : null}

        <View style={styles.dateBlock}>
          <Text style={styles.dateText}>
            {cityLine ? `${cityLine}, ` : ''}
            {props.legalNoticeDate}
          </Text>
        </View>

        <View style={styles.recipientCard}>
          <Text style={styles.recipientTitle}>{props.locale === 'fr' ? 'Destinataire' : 'Recipient'}</Text>
          <Text style={styles.recipientName}>{notEmpty(props.clientName)}</Text>
          {props.clientAddress ? <Text style={styles.recipientAddress}>{props.clientAddress}</Text> : null}
        </View>

        <View style={styles.amountBox}>
          <Text style={styles.amountLine}>
            {props.locale === 'fr' ? 'Facture concernée :' : 'Invoice reference:'} <Text style={styles.amountStrong}>{props.invoiceNumber}</Text>
          </Text>
          <Text style={styles.amountLine}>
            {props.locale === 'fr' ? 'Montant initial :' : 'Original amount:'} <Text style={styles.amountStrong}>{props.amountOriginal}</Text>
          </Text>
          <Text style={styles.amountLine}>
            {props.locale === 'fr' ? 'Montant exigible :' : 'Amount due:'} <Text style={styles.amountStrong}>{props.amountDue}</Text>
          </Text>
          {props.lateFees ? (
            <Text style={styles.amountLine}>
              {props.locale === 'fr' ? 'Pénalités de retard :' : 'Late fees:'} <Text style={styles.amountStrong}>{props.lateFees}</Text>
            </Text>
          ) : null}
          <Text style={styles.amountLine}>
            {props.locale === 'fr' ? 'Date limite légale :' : 'Legal deadline:'} <Text style={styles.amountStrong}>{props.legalDeadline}</Text>
          </Text>
        </View>

        {paragraphs.map((paragraph, index) => (
          <Text key={`paragraph-${index}`} style={styles.paragraph}>
            {paragraph}
          </Text>
        ))}

        <View style={styles.signatureBlock}>
          <Text style={styles.signatureLine}>{props.locale === 'fr' ? 'Pour la société,' : 'For the company,'}</Text>
          <Text style={styles.signatureLine}>{notEmpty(props.companyProfile.name)}</Text>
          {props.companyProfile.ownerName ? <Text style={styles.signatureLine}>{props.companyProfile.ownerName}</Text> : null}
        </View>

        <View style={styles.footer}>
          {props.includeInterestClause ? <Text style={styles.footerText}>{getInterestClause(props.locale)}</Text> : null}
          {props.customFooter ? <Text style={styles.footerText}>{props.customFooter}</Text> : null}
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

export async function renderLegalNoticePdf(props: LegalNoticePdfProps): Promise<Buffer> {
  const document = React.createElement(LegalNoticePdfTemplate, props) as unknown as React.ReactElement<DocumentProps>;
  return renderToBuffer(document);
}
