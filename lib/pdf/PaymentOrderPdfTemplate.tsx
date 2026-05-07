import { Document, Page, StyleSheet, Text, View, renderToBuffer } from '@react-pdf/renderer';
import type { DocumentProps } from '@react-pdf/renderer';
import React from 'react';

export interface PaymentOrderCompanyProfile {
  logo?: string | null;
  name: string;
  ownerName?: string | null;
  profession?: string | null;
  streetNumber?: string | null;
  streetName?: string | null;
  postalCode?: string | null;
  city?: string | null;
  country?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  vatNumber?: string | null;
  rcsNumber?: string | null;
  legalIdentifier?: string | null;
  iban?: string | null;
  bankName?: string | null;
}

export interface PaymentOrderReminderEvent {
  level: 1 | 2 | 3 | 4;
  date: string;
  channel: 'email' | 'whatsapp';
  status: 'sent' | 'failed' | 'skipped' | 'paused' | 'resumed';
}

export type PaymentOrderCourtLocation =
  | 'luxembourg'
  | 'esch_sur_alzette'
  | 'diekirch'
  | null;

export interface PaymentOrderPdfProps {
  locale: 'en' | 'fr';
  requestDate: string;
  requestPlace: string;
  caseReference: string;

  court: {
    location: PaymentOrderCourtLocation;
    name: string | null;
    address?: string | null;
    city?: string | null;
  };

  creditor: PaymentOrderCompanyProfile;
  creditorIsLegalEntity: boolean;
  representativeName?: string | null;
  representativeTitle?: string | null;
  elisantDomicile?: string | null;

  debtor: {
    name: string;
    firstName?: string | null;
    lastName?: string | null;
    profession?: string | null;
    isLegalEntity: boolean;
    companyName?: string | null;
    streetNumber?: string | null;
    streetName?: string | null;
    postalCode?: string | null;
    city?: string | null;
    country?: string | null;
    address?: string | null;
    email?: string | null;
    phone?: string | null;
    vatNumber?: string | null;
    representativeName?: string | null;
  };

  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  daysOverdue: number;

  amountOriginal: string;
  amountPaid: string;
  amountDue: string;
  amountDueCents: number;
  amountInWords: string;
  lateFees?: string | null;

  formalNoticeDate?: string | null;
  formalNoticeDeadline?: string | null;
  reminderEvents: PaymentOrderReminderEvent[];

  includeInterestClause: boolean;
  additionalNotes?: string | null;
}

const ROW_NUMBER_WIDTH = 20;
const SIDE_COLUMN_WIDTH = 132;

const BORDER = '#94a3b8';
const BORDER_SOFT = '#cbd5e1';
const TEXT_MAIN = '#0f172a';
const TEXT_MUTED = '#475569';

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: TEXT_MAIN,
    paddingTop: 24,
    paddingBottom: 32,
    paddingHorizontal: 28,
    backgroundColor: '#ffffff',
  },

  titleHeader: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: BORDER,
  },
  titleCell: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  titleText: {
    fontSize: 12,
    fontWeight: 700,
    textAlign: 'center',
    textDecoration: 'underline',
  },
  subtitleText: {
    fontSize: 9,
    color: TEXT_MUTED,
    marginTop: 4,
  },

  // Numbered form rows
  row: {
    flexDirection: 'row',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: BORDER,
    minHeight: 18,
  },
  sectionRow: {
    flexDirection: 'row',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: BORDER,
    minHeight: 22,
    backgroundColor: '#f1f5f9',
  },
  rowNumber: {
    width: ROW_NUMBER_WIDTH,
    paddingVertical: 4,
    paddingHorizontal: 2,
    borderRightWidth: 1,
    borderColor: BORDER,
    fontSize: 9,
    textAlign: 'center',
    color: TEXT_MUTED,
  },
  rowSide: {
    width: SIDE_COLUMN_WIDTH,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRightWidth: 1,
    borderColor: BORDER,
  },
  rowSideLabel: {
    fontSize: 9,
    fontWeight: 700,
    textTransform: 'uppercase',
    textAlign: 'center',
    color: TEXT_MAIN,
  },
  rowSideSub: {
    fontSize: 7.5,
    color: TEXT_MUTED,
    textAlign: 'center',
    marginTop: 2,
  },
  rowCell: {
    flex: 1,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  rowLabel: {
    fontSize: 9,
    color: TEXT_MAIN,
  },
  rowValue: {
    fontSize: 10,
    color: TEXT_MAIN,
    fontWeight: 700,
  },
  rowHint: {
    fontSize: 7.5,
    color: TEXT_MUTED,
    fontStyle: 'italic',
  },
  rowInline: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  checkbox: {
    width: 9,
    height: 9,
    borderWidth: 1,
    borderColor: TEXT_MAIN,
    marginRight: 4,
    marginLeft: 2,
  },
  checkboxChecked: {
    backgroundColor: TEXT_MAIN,
  },

  // Signature
  signatureBlock: {
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  signatureText: {
    fontSize: 9,
    color: TEXT_MUTED,
  },
  signatureStrong: {
    fontSize: 10,
    fontWeight: 700,
    color: TEXT_MAIN,
    marginTop: 2,
  },

  // Annexes page
  annexTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: TEXT_MAIN,
    marginBottom: 10,
    textTransform: 'uppercase',
    textAlign: 'center',
    letterSpacing: 0.4,
  },
  annexSectionTitle: {
    fontSize: 10.5,
    fontWeight: 700,
    color: TEXT_MAIN,
    marginTop: 10,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_SOFT,
    paddingBottom: 2,
  },
  kvRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 9.5,
    color: TEXT_MAIN,
    paddingVertical: 2,
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER_SOFT,
  },
  kvStrong: {
    fontWeight: 700,
  },
  paragraph: {
    fontSize: 9.5,
    lineHeight: 1.55,
    color: TEXT_MAIN,
    marginBottom: 6,
    textAlign: 'justify',
  },
  bullet: {
    fontSize: 9.5,
    lineHeight: 1.5,
    color: TEXT_MAIN,
    marginBottom: 2,
    marginLeft: 12,
  },
  footerNote: {
    fontSize: 8,
    color: TEXT_MUTED,
    lineHeight: 1.45,
    marginTop: 6,
  },

  pageNumber: {
    position: 'absolute',
    fontSize: 8,
    bottom: 14,
    right: 28,
    color: '#64748b',
  },
});

function trimOrNull(value?: string | null): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function notEmpty(value?: string | null): string {
  return trimOrNull(value) ?? '';
}

function joinParts(parts: Array<string | null | undefined>, separator = ' '): string {
  return parts
    .map((part) => (typeof part === 'string' ? part.trim() : ''))
    .filter((part) => part.length > 0)
    .join(separator);
}

function isLuxembourgCountry(value?: string | null): boolean {
  const normalized = trimOrNull(value)?.toLowerCase();
  return normalized === 'luxembourg' || normalized === 'luxemburg' || normalized === 'luxemburgo';
}

function formatDomicile(postalCode?: string | null, city?: string | null, country?: string | null): string {
  // Strip any leading "L-", "L", or repeated combinations (e.g. "L-L-7633" → "7633").
  const pc = trimOrNull(postalCode)?.replace(/^(?:L\s*-?\s*)+/i, '');
  const rawCity = trimOrNull(city);
  // Also strip an "L-XXXX" prefix accidentally stored in the city field.
  const locality = rawCity?.replace(/^L\s*-?\s*\d{3,5}\s*/i, '').trim() || rawCity;
  const c = trimOrNull(country);

  if (!pc && !locality && !c) {
    return '';
  }

  const localityLine = joinParts([pc, locality], ' ');
  if (isLuxembourgCountry(c)) {
    if (!localityLine) {
      return 'Luxembourg';
    }
    return `L-${localityLine}`;
  }

  return joinParts([localityLine, c], ', ');
}

/**
 * Best-effort split of a free-form address string into a street part and a
 * domicile (postal code + city + country) part. Used as a fallback when the
 * structured address fields are missing but the legacy single-line address
 * still contains everything.
 */
function splitAddressLine(address: string | null | undefined): { street: string; domicile: string } {
  const raw = trimOrNull(address);
  if (!raw) return { street: '', domicile: '' };

  const match = raw.match(/^(.*?)[,\s]+(L\s*-?\s*\d{3,5}[\s\S]*)$/i);
  if (match) {
    const street = match[1].replace(/[,\s]+$/, '').trim();
    const domicileRest = match[2].trim();
    // Normalize the leading "L" / "L " / "L-" into a single "L-".
    const domicile = domicileRest.replace(/^L\s*-?\s*/i, 'L-');
    return { street, domicile };
  }

  return { street: raw, domicile: '' };
}

function normalizeLabel(label: string): string {
  return label.replace(/:\s*$/, '').trim();
}

function formatLabel(label: string, value?: string | null): string {
  const cleanValue = trimOrNull(value);
  if (!cleanValue) return '';
  return `${normalizeLabel(label)}: ${cleanValue}`;
}

function splitFullName(fullName: string | null | undefined): { firstName: string; lastName: string } {
  const raw = (fullName ?? '').trim();
  if (!raw) return { firstName: '', lastName: '' };
  const parts = raw.split(/\s+/);
  if (parts.length === 1) return { firstName: '', lastName: parts[0] };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
}

function getLabels(locale: 'en' | 'fr') {
  if (locale === 'fr') {
    return {
      original: 'ORIGINAL',
      caseNumber: 'N°',
      creditorSide: 'PARTIE\nCRÉANCIÈRE',
      debtorSide: 'PARTIE\nDÉBITRICE',
      competenceNote: 'Compétence\njusqu\'à\n15.000.-\nEUROS incl.',
      title: 'REQUÊTE EN MATIÈRE D\'ORDONNANCE DE PAIEMENT',
      intro: 'La partie créancière soussignée :',
      vatShort: 'TVA',
      rcsShort: 'RCS',
      idShort: 'ID',
      lastName: 'Nom',
      lastNameHint: '(ou personne morale)',
      firstName: 'Prénom',
      firstNameHint: '(ou forme de personne morale)',
      profession: 'Profession',
      street: 'rue et numéro',
      domicile: 'Domicile :',
      domicileHint: '(code postal et localité)',
      moralHint: 'En cas de requête d\'une personne morale (organe représentatif ou représentant légal)',
      moralAgainstHint: 'En cas de requête contre une personne morale (organe représentatif ou représentant légal)',
      optional: '(facultatif)',
      elisantDomicile: 'Élisant domicile en l\'étude de :',
      prays: 'prie le Juge de paix de',
      locLux: 'Luxembourg',
      locEsch: 'Esch-sur-Alzette',
      locDiek: 'Diekirch',
      prayTail: 'de délivrer une',
      ordinanceTitle: 'ORDONNANCE CONDITIONNELLE DE PAIEMENT',
      againstDebtor: 'contre la partie débitrice :',
      amountHeading: 'POUR LE MONTANT DE :',
      amountInWords: 'en toutes lettres :',
      cause: 'redû pour (cause de la créance) :',
      causeHint: '(à indiquer les numéros et dates des factures)',
      interest: 'avec les intérêts légaux',
      ibanLead: 'à virer au compte N°',
      ibanTail: 'de la partie créancière (ou de son mandataire)',
      bankLead: 'auprès de :',
      bankHint: '(nom de l\'établissement financier Banque ou C.C.P)',
      signatureText: '(Signature de la partie créancière)',
      dateWord: 'le',
      factsTitle: 'Exposé des faits',
      channelEmail: 'E-mail',
      channelWhatsapp: 'WhatsApp',
      // Annex
      annexTitle: 'Dossier de recouvrement – Pièces justificatives',
      claim: 'Détail de la créance',
      invoiceRef: 'Facture concernée',
      invoiceDate: 'Date de la facture',
      dueDate: 'Date d\'échéance',
      daysOverdue: 'Jours de retard',
      days: 'jour(s)',
      amounts: 'Décomposition du montant réclamé',
      amountOriginal: 'Montant initial de la facture',
      amountPaid: 'Montant déjà réglé',
      lateFees: 'Pénalités de retard',
      amountDue: 'Somme restant due',
      timeline: 'Démarches amiables effectuées',
      formalNoticeSent: 'Mise en demeure envoyée le',
      formalNoticeDeadline: 'Échéance de la mise en demeure',
      reminderLevelSoft: 'Rappel amical',
      reminderLevelMedium: 'Rappel ferme',
      reminderLevelFirm: 'Dernier rappel',
      reminderLevelFormal: 'Mise en demeure',
      facts: `Les démarches amiables entreprises par le demandeur étant demeurées infructueuses et la mise en demeure adressée au défendeur n'ayant pas été suivie de paiement dans le délai légal imparti, le demandeur sollicite respectueusement du Juge de Paix la délivrance d'une ordonnance conditionnelle de paiement en application des dispositions du Nouveau Code de Procédure Civile régissant la procédure de paiement pour les créances d'un montant inférieur à 15 000 €.`,
      interestClause: 'Les intérêts de retard et l\'indemnité forfaitaire pour frais de recouvrement sont réclamés conformément aux dispositions légales en vigueur.',
      attachments: 'Pièces annexées à la présente requête',
      attach1: '— Copie de la facture impayée',
      attach2: '— Copie de la mise en demeure',
      attach3: '— Historique des relances',
      nameLabel: 'Nom :',
      firstNameLabel: 'Prénom :',
      professionLabel: 'Profession :',
      defaultDebtorProfession: 'Dirigeant de société',
      streetLabel: 'rue et numéro :',
      domicileLabel: 'Domicile :',
      representativeLabel: 'Représentant légal :',
      ibanLabel: 'IBAN :',
      bankLabel: 'Banque :',
      elisantLabel: 'Élisant domicile en l\'étude de :',
    };
  }

  // English
  return {
    original: 'ORIGINAL',
    caseNumber: 'Case No.',
    creditorSide: 'CREDITOR\nPARTY',
    debtorSide: 'DEBTOR\nPARTY',
    competenceNote: 'Jurisdiction\nup to\n€15,000\n(incl.)',
    title: 'PAYMENT ORDER REQUEST',
    intro: 'The undersigned creditor party:',
    vatShort: 'VAT',
    rcsShort: 'RCS',
    idShort: 'ID',
    lastName: 'Last name',
    lastNameHint: '(or legal entity)',
    firstName: 'First name',
    firstNameHint: '(or legal form)',
    profession: 'Profession',
    street: 'street and number',
    domicile: 'Domicile:',
    domicileHint: '(postal code and locality)',
    moralHint: 'For a request filed by a legal entity (representative body or legal representative)',
    moralAgainstHint: 'For a request filed against a legal entity (representative body or legal representative)',
    optional: '(optional)',
    elisantDomicile: 'Electing domicile at the law firm of:',
    prays: 'requests the Justice of the Peace of',
    locLux: 'Luxembourg',
    locEsch: 'Esch-sur-Alzette',
    locDiek: 'Diekirch',
    prayTail: 'to issue a',
    ordinanceTitle: 'CONDITIONAL PAYMENT ORDER',
    againstDebtor: 'against the debtor party:',
    amountHeading: 'FOR THE AMOUNT OF:',
    amountInWords: 'in words:',
    cause: 'owed for (cause of the claim):',
    causeHint: '(indicate invoice numbers and dates)',
    interest: 'together with statutory late interest',
    ibanLead: 'to be paid to account No.',
    ibanTail: 'of the creditor (or their representative)',
    bankLead: 'held at:',
    bankHint: '(name of the financial institution — Bank or C.C.P)',
    signatureText: '(Signature of the creditor party)',
    dateWord: 'on',
    factsTitle: 'Statement of facts',
    channelEmail: 'Email',
    channelWhatsapp: 'WhatsApp',
    // Annex
    annexTitle: 'Recovery file – Supporting documents',
    claim: 'Claim details',
    invoiceRef: 'Invoice reference',
    invoiceDate: 'Invoice date',
    dueDate: 'Due date',
    daysOverdue: 'Days overdue',
    days: 'day(s)',
    amounts: 'Claim amount breakdown',
    amountOriginal: 'Original invoice amount',
    amountPaid: 'Amount already paid',
    lateFees: 'Late fees',
    amountDue: 'Outstanding amount',
    timeline: 'Amicable recovery attempts',
    formalNoticeSent: 'Formal notice sent on',
    formalNoticeDeadline: 'Formal notice deadline',
    reminderLevelSoft: 'Soft reminder',
    reminderLevelMedium: 'Medium reminder',
    reminderLevelFirm: 'Firm reminder',
    reminderLevelFormal: 'Formal notice',
    facts: `The claimant's amicable recovery attempts have remained unsuccessful and the formal notice served on the defendant has not been followed by payment within the legal deadline. The claimant respectfully requests the Justice of the Peace to issue a conditional payment order in accordance with the provisions of the Luxembourg New Code of Civil Procedure governing the payment procedure for claims below €15,000.`,
    interestClause: 'Late interest and the flat-rate recovery-cost compensation are claimed in accordance with the applicable legal provisions.',
    attachments: 'Documents attached to this request',
    attach1: '— Copy of the unpaid invoice',
    attach2: '— Copy of the formal notice',
    attach3: '— Reminder history',
    nameLabel: 'Last name:',
    firstNameLabel: 'First name:',
    professionLabel: 'Profession:',
    defaultDebtorProfession: 'Company director',
    streetLabel: 'street and number:',
    domicileLabel: 'Domicile:',
    representativeLabel: 'Legal representative:',
    ibanLabel: 'IBAN:',
    bankLabel: 'Bank:',
    elisantLabel: 'Electing domicile at the law firm of:',
  };
}

function getReminderLevelLabel(level: 1 | 2 | 3 | 4, labels: ReturnType<typeof getLabels>): string {
  switch (level) {
    case 1: return labels.reminderLevelSoft;
    case 2: return labels.reminderLevelMedium;
    case 3: return labels.reminderLevelFirm;
    case 4: return labels.reminderLevelFormal;
    default: return '';
  }
}

function getReminderChannelLabel(
  channel: PaymentOrderReminderEvent['channel'],
  labels: ReturnType<typeof getLabels>
): string {
  return channel === 'whatsapp' ? labels.channelWhatsapp : labels.channelEmail;
}

interface FormRowProps {
  number?: number;
  sideLabel?: string;
  sideSub?: string;
  children: React.ReactNode;
  isSection?: boolean;
  hideNumber?: boolean;
}

function FormRow({ number, sideLabel, sideSub, children, isSection, hideNumber }: FormRowProps) {
  return (
    <View style={isSection ? styles.sectionRow : styles.row} wrap={false}>
      {hideNumber ? null : (
        <Text style={styles.rowNumber}>{number ? String(number) : ' '}</Text>
      )}
      <View style={styles.rowSide}>
        {sideLabel ? <Text style={styles.rowSideLabel}>{sideLabel}</Text> : null}
        {sideSub ? <Text style={styles.rowSideSub}>{sideSub}</Text> : null}
      </View>
      <View style={styles.rowCell}>{children}</View>
    </View>
  );
}

function Checkbox({ checked }: { checked: boolean }) {
  return <View style={[styles.checkbox, checked ? styles.checkboxChecked : {}]} />;
}

export function PaymentOrderPdfTemplate(props: PaymentOrderPdfProps) {
  const labels = getLabels(props.locale);
  const creditor = props.creditor;

  const { firstName: creditorDerivedFirst, lastName: creditorDerivedLast } =
    splitFullName(creditor.ownerName);
  const creditorLastName = props.creditorIsLegalEntity
    ? creditor.name
    : (trimOrNull(creditor.ownerName) ? creditorDerivedLast || creditor.name : creditor.name);
  const creditorFirstName = props.creditorIsLegalEntity ? '' : creditorDerivedFirst;
  const creditorStreet = joinParts([creditor.streetNumber, creditor.streetName], ' ');
  const creditorDomicile = formatDomicile(creditor.postalCode, creditor.city, creditor.country);

  const { firstName: debtorDerivedFirst, lastName: debtorDerivedLast } =
    splitFullName(props.debtor.name);
  const debtorLastName = props.debtor.isLegalEntity
    ? (props.debtor.companyName || props.debtor.name)
    : (props.debtor.lastName || debtorDerivedLast || props.debtor.name);
  const debtorFirstName = props.debtor.isLegalEntity ? '' : (props.debtor.firstName || debtorDerivedFirst);
  const debtorStructuredStreet = joinParts([props.debtor.streetNumber, props.debtor.streetName], ' ');
  const debtorStructuredDomicile = formatDomicile(props.debtor.postalCode, props.debtor.city, props.debtor.country);
  // Fallback: when structured fields are missing, parse the legacy single-line
  // address so the street stays in row 12 and the locality lands in row 13.
  const parsedFromAddress = splitAddressLine(props.debtor.address);
  const debtorStreet = debtorStructuredStreet || parsedFromAddress.street;
  const debtorDomicileResolved = debtorStructuredDomicile || parsedFromAddress.domicile;
  const debtorProfession = labels.defaultDebtorProfession;

  const courtLoc = props.court.location;

  return (
    <Document>
   
      <Page size="A4" style={styles.page}>
        <View style={styles.titleHeader} wrap={false}>
          <View style={styles.titleCell}>
            <Text style={styles.titleText}>{labels.title}</Text>
            <Text style={styles.subtitleText}>{labels.intro}</Text>
          </View>
        </View>

        {/* 1. Nom (or legal entity) */}
        <FormRow number={1} sideLabel={labels.creditorSide}>
          <View style={styles.rowInline}>
            <Text style={styles.rowValue}>{formatLabel(labels.lastName, creditorLastName)}</Text>
            {!trimOrNull(creditorLastName) ? <Text style={styles.rowHint}>{labels.lastNameHint}</Text> : null}
          </View>
        </FormRow>

        {/* 2. Prénom */}
        <FormRow number={2}>
          <View style={styles.rowInline}>
            <Text style={styles.rowValue}>{formatLabel(labels.firstName, creditorFirstName)}</Text>
            {!trimOrNull(creditorFirstName) ? <Text style={styles.rowHint}>{labels.firstNameHint}</Text> : null}
          </View>
        </FormRow>

        {/* 3. Profession */}
        <FormRow number={3}>
          <View style={styles.rowInline}>
            <Text style={styles.rowValue}>{formatLabel(labels.profession, creditor.profession)}</Text>
          </View>
        </FormRow>

        {/* 4. Street and number */}
        <FormRow number={4}>
          <View style={styles.rowInline}>
            <Text style={styles.rowValue}>{formatLabel(labels.street, creditorStreet)}</Text>
          </View>
        </FormRow>

        {/* 5. Domicile */}
        <FormRow number={5}>
          <View style={styles.rowInline}>
            <Text style={styles.rowValue}>{formatLabel(labels.domicile, creditorDomicile)}</Text>
            {!trimOrNull(creditorDomicile) ? <Text style={styles.rowHint}>{labels.domicileHint}</Text> : null}
          </View>
        </FormRow>

        {/* 6. Legal representative (for legal entity) */}
        <FormRow number={6}>
          <View>
            {props.creditorIsLegalEntity ? <Text style={styles.rowHint}>{labels.moralHint}:</Text> : null}
            <Text style={styles.rowValue}>{props.creditorIsLegalEntity ? joinParts([props.representativeName, props.representativeTitle], ' — ') : ''}</Text>
          </View>
        </FormRow>

        {/* 7. Elisant domicile (optional) */}
        <FormRow number={7} sideLabel={labels.optional}>
          <View style={styles.rowInline}>
            <Text style={styles.rowValue}>{formatLabel(labels.elisantDomicile, props.elisantDomicile)}</Text>
          </View>
        </FormRow>

        {/* 8. Juge de paix checkboxes */}
        <FormRow number={8}>
          <View>
            <View style={styles.rowInline}>
              <Text style={styles.rowLabel}>{labels.prays}</Text>
            </View>
            <View style={[styles.rowInline, { marginTop: 2 }]}>
              <Checkbox checked={courtLoc === 'luxembourg'} />
              <Text style={styles.rowLabel}>{labels.locLux}</Text>
              <Checkbox checked={courtLoc === 'esch_sur_alzette'} />
              <Text style={styles.rowLabel}>{labels.locEsch}</Text>
              <Checkbox checked={courtLoc === 'diekirch'} />
              <Text style={styles.rowLabel}>{labels.locDiek}</Text>
              <Text style={styles.rowLabel}>— {labels.prayTail}</Text>
            </View>
            <Text style={[styles.rowValue, { textAlign: 'center', marginTop: 4 }]}>
              {labels.ordinanceTitle}
            </Text>
            <Text style={[styles.rowLabel, { marginTop: 2 }]}>{labels.againstDebtor}</Text>
          </View>
        </FormRow>

        {/* 9. Debtor name */}
        <FormRow number={9} sideLabel={labels.debtorSide}>
          <View style={styles.rowInline}>
            <Text style={styles.rowValue}>{formatLabel(labels.lastName, debtorLastName)}</Text>
            {!trimOrNull(debtorLastName) ? <Text style={styles.rowHint}>{labels.lastNameHint}</Text> : null}
          </View>
        </FormRow>

        {/* 10. Debtor first name */}
        <FormRow number={10}>
          <View style={styles.rowInline}>
            <Text style={styles.rowValue}>{formatLabel(labels.firstName, debtorFirstName)}</Text>
            {!trimOrNull(debtorFirstName) ? <Text style={styles.rowHint}>{labels.firstNameHint}</Text> : null}
          </View>
        </FormRow>

        {/* 11. Debtor profession */}
        <FormRow number={11}>
          <View style={styles.rowInline}>
            <Text style={styles.rowValue}>{formatLabel(labels.profession, debtorProfession)}</Text>
          </View>
        </FormRow>

        {/* 12. Debtor street */}
        <FormRow number={12}>
          <View style={styles.rowInline}>
            <Text style={styles.rowValue}>{formatLabel(labels.street, debtorStreet)}</Text>
          </View>
        </FormRow>

        {/* 13. Debtor domicile */}
        <FormRow number={13}>
          <View style={styles.rowInline}>
            <Text style={styles.rowValue}>{formatLabel(labels.domicile, debtorDomicileResolved)}</Text>
            {!trimOrNull(debtorDomicileResolved) ? <Text style={styles.rowHint}>{labels.domicileHint}</Text> : null}
          </View>
        </FormRow>

        {/* 14. Debtor representative */}
        <FormRow number={14}>
          <View>
            {props.debtor.isLegalEntity ? <Text style={styles.rowHint}>{labels.moralAgainstHint}:</Text> : null}
            <Text style={styles.rowValue}>
              {props.debtor.isLegalEntity ? notEmpty(props.debtor.representativeName) : ''}
            </Text>
          </View>
        </FormRow>

        {/* 15. Amount */}
        <FormRow number={15} sideLabel={labels.competenceNote}>
          <View>
            <View style={styles.rowInline}>
              <Text style={styles.rowLabel}>{labels.amountHeading}</Text>
              <Text style={styles.rowValue}>{props.amountDue}</Text>
            </View>
            <View style={{ marginTop: 2 }}>
              <Text style={styles.rowLabel}>{labels.amountInWords}</Text>
              <Text style={[styles.rowValue, { fontWeight: 400, fontStyle: 'italic' }]}>
                {notEmpty(props.amountInWords)}
              </Text>
            </View>
          </View>
        </FormRow>

        {/* 16. Cause */}
        <FormRow number={16}>
          <View>
            <Text style={styles.rowLabel}>
              {labels.cause} <Text style={styles.rowHint}>{labels.causeHint}</Text>
            </Text>
            <Text style={styles.rowValue}>
              {joinParts([props.invoiceNumber, props.invoiceDate ? `(${props.invoiceDate})` : null], ' ')}
            </Text>
          </View>
        </FormRow>

        {/* 17. Interest */}
        <FormRow number={17}>
          <View style={styles.rowInline}>
            <Checkbox checked={props.includeInterestClause} />
            <Text style={styles.rowValue}>{labels.interest}</Text>
          </View>
        </FormRow>

        {/* 18. IBAN */}
        <FormRow number={18}>
          <View style={styles.rowInline}>
            <Text style={styles.rowValue}>{formatLabel(labels.ibanLabel, creditor.iban)}</Text>
          </View>
        </FormRow>

        {/* 19. Bank */}
        <FormRow number={19}>
          <View style={styles.rowInline}>
            <Text style={styles.rowValue}>{formatLabel(labels.bankLabel, creditor.bankName)}</Text>
            {!trimOrNull(creditor.bankName) ? <Text style={styles.rowHint}>{labels.bankHint}</Text> : null}
          </View>
        </FormRow>

        {/* 20. Place, date */}
        <FormRow number={20}>
          <View style={styles.rowInline}>
            <Text style={styles.rowValue}>{`${notEmpty(props.requestPlace)}, ${labels.dateWord} ${notEmpty(props.requestDate)}`}</Text>
          </View>
        </FormRow>

        {/* 21. Signature */}
        <FormRow number={21}>
          <View>
            <Text style={styles.signatureText}>{labels.signatureText}</Text>
            <Text style={styles.signatureStrong}>
              {notEmpty(props.representativeName || creditor.ownerName || creditor.name)}
              {props.representativeTitle ? ` — ${props.representativeTitle}` : ''}
            </Text>
          </View>
        </FormRow>

        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
      </Page>

      {/* ------------------------------------------------------------------- */}
      {/* Page 2: annex — claim details, amounts, timeline, facts             */}
      {/* ------------------------------------------------------------------- */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.annexTitle}>{labels.annexTitle}</Text>

        <Text style={styles.annexSectionTitle}>{labels.claim}</Text>
        <View style={styles.kvRow}>
          <Text>{labels.invoiceRef}</Text>
          <Text style={styles.kvStrong}>{notEmpty(props.invoiceNumber)}</Text>
        </View>
        <View style={styles.kvRow}>
          <Text>{labels.invoiceDate}</Text>
          <Text style={styles.kvStrong}>{notEmpty(props.invoiceDate)}</Text>
        </View>
        <View style={styles.kvRow}>
          <Text>{labels.dueDate}</Text>
          <Text style={styles.kvStrong}>{notEmpty(props.dueDate)}</Text>
        </View>
        <View style={styles.kvRow}>
          <Text>{labels.daysOverdue}</Text>
          <Text style={styles.kvStrong}>{`${props.daysOverdue} ${labels.days}`}</Text>
        </View>

        <Text style={styles.annexSectionTitle}>{labels.amounts}</Text>
        <View style={styles.kvRow}>
          <Text>{labels.amountOriginal}</Text>
          <Text style={styles.kvStrong}>{props.amountOriginal}</Text>
        </View>
        <View style={styles.kvRow}>
          <Text>{labels.amountPaid}</Text>
          <Text style={styles.kvStrong}>{props.amountPaid}</Text>
        </View>
        {props.lateFees ? (
          <View style={styles.kvRow}>
            <Text>{labels.lateFees}</Text>
            <Text style={styles.kvStrong}>{props.lateFees}</Text>
          </View>
        ) : null}
        <View style={styles.kvRow}>
          <Text style={styles.kvStrong}>{labels.amountDue}</Text>
          <Text style={styles.kvStrong}>{props.amountDue}</Text>
        </View>

        <Text style={styles.annexSectionTitle}>{labels.timeline}</Text>
        {props.formalNoticeDate ? (
          <View style={styles.kvRow}>
            <Text>{labels.formalNoticeSent}</Text>
            <Text style={styles.kvStrong}>{props.formalNoticeDate}</Text>
          </View>
        ) : null}
        {props.formalNoticeDeadline ? (
          <View style={styles.kvRow}>
            <Text>{labels.formalNoticeDeadline}</Text>
            <Text style={styles.kvStrong}>{props.formalNoticeDeadline}</Text>
          </View>
        ) : null}
        {props.reminderEvents.map((event, index) => (
          <View key={`ev-${index}`} style={styles.kvRow}>
            <Text>{`${getReminderLevelLabel(event.level, labels)} (${getReminderChannelLabel(event.channel, labels)})`}</Text>
            <Text style={styles.kvStrong}>{event.date}</Text>
          </View>
        ))}

        <Text style={styles.annexSectionTitle}>{labels.factsTitle}</Text>
        <Text style={styles.paragraph}>{labels.facts}</Text>

        <Text style={styles.annexSectionTitle}>{labels.attachments}</Text>
        <Text style={styles.bullet}>{labels.attach1}</Text>
        <Text style={styles.bullet}>{labels.attach2}</Text>
        <Text style={styles.bullet}>{labels.attach3}</Text>

        {props.includeInterestClause ? (
          <Text style={styles.footerNote}>{labels.interestClause}</Text>
        ) : null}
        {props.additionalNotes ? <Text style={styles.footerNote}>{props.additionalNotes}</Text> : null}

        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
      </Page>
    </Document>
  );
}

export async function renderPaymentOrderPdf(props: PaymentOrderPdfProps): Promise<Buffer> {
  const buildDocument = (nextProps: PaymentOrderPdfProps) =>
    React.createElement(PaymentOrderPdfTemplate, nextProps) as unknown as React.ReactElement<DocumentProps>;

  try {
    return await renderToBuffer(buildDocument(props));
  } catch (error) {
    if (props.creditor.logo) {
      return renderToBuffer(buildDocument({
        ...props,
        creditor: {
          ...props.creditor,
          logo: null,
        },
      }));
    }
    throw error;
  }
}
