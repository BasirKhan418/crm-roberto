export type ReminderTemplateKey = 'soft' | 'medium' | 'firm' | 'formalNotice';

export interface ReminderTemplate {
  subject: string;
  body: string;
}

export type ReminderLocaleTemplates = Record<ReminderTemplateKey, ReminderTemplate>;
export type ReminderTemplates = Record<'en' | 'fr', ReminderLocaleTemplates>;

export const DEFAULT_REMINDER_TEMPLATES: ReminderTemplates = {
  en: {
    soft: {
      subject: 'Friendly reminder - invoice {{invoiceNumber}}',
      body:
        'Hello {{clientName}},\n\nThis is a friendly reminder that invoice {{invoiceNumber}} dated {{invoiceDate}} was due on {{dueDate}}.\n\nAmount due: {{amountDue}}.\nLate fees: {{lateFees}}\n\nIf payment has already been made, please ignore this message. Otherwise, you can use the following payment link: {{paymentLink}}\n\nThank you for your business.\n\nBest regards,\n{{companyName}}',
    },
    medium: {
      subject: 'Payment follow-up - invoice {{invoiceNumber}}',
      body:
        'Hello {{clientName}},\n\nWe are following up regarding invoice {{invoiceNumber}}, which is now {{daysOverdue}} day(s) overdue.\n\nOutstanding balance: {{amountDue}} (original amount: {{amountOriginal}}).\n\nPlease proceed with payment as soon as possible using this link: {{paymentLink}}\n\nIf you have any questions or need support, please contact us.\n\nKind regards,\n{{companyName}}',
    },
    firm: {
      subject: 'Final reminder before formal notice - invoice {{invoiceNumber}}',
      body:
        'Hello {{clientName}},\n\nThis is a final reminder for overdue invoice {{invoiceNumber}}.\n\nAmount due: {{amountDue}}.\nLate fees: {{lateFees}}\n\nUnless payment is received promptly, we may proceed with formal recovery steps.\n\nPayment link: {{paymentLink}}\n\nRegards,\n{{companyName}}',
    },
    formalNotice: {
      subject: 'Formal notice - invoice {{invoiceNumber}}',
      body:
        'Hello {{clientName}},\n\nPlease find attached the formal notice concerning invoice {{invoiceNumber}}.\n\nAmount due: {{amountDue}}.\nLegal deadline: {{legalDeadline}}.\n\nRegards,\n{{companyName}}',
    },
  },
  fr: {
    soft: {
      subject: 'Rappel amical - facture {{invoiceNumber}}',
      body:
        "Bonjour {{clientName}},\n\nNous vous rappelons aimablement que la facture {{invoiceNumber}} du {{invoiceDate}} est arrivée à échéance le {{dueDate}}.\n\nMontant restant dû : {{amountDue}}.\nPénalités de retard : {{lateFees}}\n\nSi le paiement a déjà été effectué, merci d'ignorer ce message. Sinon, vous pouvez régler ici : {{paymentLink}}\n\nCordialement,\n{{companyName}}",
    },
    medium: {
      subject: 'Relance de paiement - facture {{invoiceNumber}}',
      body:
        "Bonjour {{clientName}},\n\nNous revenons vers vous concernant la facture {{invoiceNumber}}, en retard de {{daysOverdue}} jour(s).\n\nSolde restant dû : {{amountDue}} (montant initial : {{amountOriginal}}).\n\nNous vous remercions d'effectuer le paiement dans les meilleurs délais via ce lien : {{paymentLink}}\n\nEn cas de question, nous restons à votre disposition.\n\nBien cordialement,\n{{companyName}}",
    },
    firm: {
      subject: 'Dernier rappel avant mise en demeure - facture {{invoiceNumber}}',
      body:
        'Bonjour {{clientName}},\n\nCeci constitue un dernier rappel concernant la facture {{invoiceNumber}} impayée.\n\nMontant dû : {{amountDue}}.\nPénalités de retard : {{lateFees}}\n\nSans régularisation rapide, une procédure de recouvrement formelle pourra être engagée.\n\nLien de paiement : {{paymentLink}}\n\nCordialement,\n{{companyName}}',
    },
    formalNotice: {
      subject: 'Mise en demeure - facture {{invoiceNumber}}',
      body:
        "Madame, Monsieur,\n\nSauf erreur de notre part, la facture {{invoiceNumber}} demeure impayée à ce jour, pour un montant de {{amountDue}}.\n\nPar la présente, nous vous mettons en demeure de régler cette somme dans le délai légal indiqué au document joint, soit avant le {{legalDeadline}}.\n\nÀ défaut de paiement dans ce délai, nous nous réserverons le droit d'engager toute procédure utile pour le recouvrement de notre créance, avec application des frais et intérêts prévus par la loi.\n\nNous vous invitons à régulariser votre situation sans délai via le lien de paiement suivant : {{paymentLink}}\n\nCordialement,\n{{companyName}}",
    },
  },
};

type PartialReminderTemplate = Partial<ReminderTemplate> | null | undefined;
type PartialReminderLocaleTemplates = Partial<Record<ReminderTemplateKey, PartialReminderTemplate>> | null | undefined;
type PartialReminderTemplates = Partial<Record<'en' | 'fr', PartialReminderLocaleTemplates>> | null | undefined;

const FRENCH_TEXT_REPAIRS: Array<[RegExp, string]> = [
  [/arrivee a echeance/gi, 'arrivée à échéance'],
  [/Montant restant du\b/gi, 'Montant restant dû'],
  [/Solde restant du\b/gi, 'Solde restant dû'],
  [/Montant du\b/gi, 'Montant dû'],
  [/Penalites de retard/gi, 'Pénalités de retard'],
  [/a deja ete effectue/gi, 'a déjà été effectué'],
  [/regler/gi, 'régler'],
  [/delais/gi, 'délais'],
  [/impayee/gi, 'impayée'],
  [/Sans regularisation rapide, une procedure de recouvrement formelle pourra etre engagee\./gi, 'Sans régularisation rapide, une procédure de recouvrement formelle pourra être engagée.'],
  [/regularisation/gi, 'régularisation'],
  [/procedure/gi, 'procédure'],
  [/demeure impayee a ce jour/gi, 'demeure impayée à ce jour'],
  [/Par la presente/gi, 'Par la présente'],
  [/A defaut/gi, 'À défaut'],
  [/interets/gi, 'intérêts'],
  [/creance/gi, 'créance'],
  [/sans delai/gi, 'sans délai'],
  [/Lien de paiement:/gi, 'Lien de paiement :'],
  [/Montant restant dû:/gi, 'Montant restant dû :'],
  [/Solde restant dû:/gi, 'Solde restant dû :'],
  [/Montant dû:/gi, 'Montant dû :'],
  [/Pénalités de retard:/gi, 'Pénalités de retard :'],
];

const LATE_FEES_VARIABLE_REGEX = /\{\{\s*lateFees\s*\}\}|\{\s*lateFees\s*\}/i;
const AMOUNT_DUE_VARIABLE_REGEX = /\{\{\s*amountDue\s*\}\}|\{\s*amountDue\s*\}/i;

function cloneReminderTemplate(template: ReminderTemplate): ReminderTemplate {
  return {
    subject: template.subject,
    body: template.body,
  };
}

export function cloneReminderLocaleTemplates(templates: ReminderLocaleTemplates): ReminderLocaleTemplates {
  return {
    soft: cloneReminderTemplate(templates.soft),
    medium: cloneReminderTemplate(templates.medium),
    firm: cloneReminderTemplate(templates.firm),
    formalNotice: cloneReminderTemplate(templates.formalNotice),
  };
}

export function cloneReminderTemplates(templates: ReminderTemplates = DEFAULT_REMINDER_TEMPLATES): ReminderTemplates {
  return {
    en: cloneReminderLocaleTemplates(templates.en),
    fr: cloneReminderLocaleTemplates(templates.fr),
  };
}

function applyFrenchTextRepairs(value: string): string {
  return FRENCH_TEXT_REPAIRS.reduce((current, [pattern, replacement]) => current.replace(pattern, replacement), value);
}

function ensureFrenchSoftLateFeesLine(body: string): string {
  if (LATE_FEES_VARIABLE_REGEX.test(body)) {
    return body;
  }

  const lines = body.split('\n');
  const amountLineIndex = lines.findIndex((line) => AMOUNT_DUE_VARIABLE_REGEX.test(line));

  if (amountLineIndex === -1) {
    return `${body.trim()}\nPénalités de retard : {{lateFees}}`;
  }

  lines.splice(amountLineIndex + 1, 0, 'Pénalités de retard : {{lateFees}}');
  return lines.join('\n');
}

function normalizeReminderTemplate(locale: 'en' | 'fr', level: ReminderTemplateKey, template: ReminderTemplate): ReminderTemplate {
  if (locale !== 'fr') {
    return cloneReminderTemplate(template);
  }

  const normalized = {
    subject: applyFrenchTextRepairs(template.subject),
    body: applyFrenchTextRepairs(template.body),
  };

  if (level === 'soft') {
    normalized.body = ensureFrenchSoftLateFeesLine(normalized.body);
  }

  return normalized;
}

export function normalizeReminderTemplates(input?: PartialReminderTemplates): { templates: ReminderTemplates; changed: boolean } {
  let changed = false;

  const templates: ReminderTemplates = {
    en: cloneReminderLocaleTemplates(DEFAULT_REMINDER_TEMPLATES.en),
    fr: cloneReminderLocaleTemplates(DEFAULT_REMINDER_TEMPLATES.fr),
  };

  const locales: Array<'en' | 'fr'> = ['en', 'fr'];
  const levels: ReminderTemplateKey[] = ['soft', 'medium', 'firm', 'formalNotice'];

  for (const locale of locales) {
    for (const level of levels) {
      const source = input?.[locale]?.[level];
      const fallback = DEFAULT_REMINDER_TEMPLATES[locale][level];

      const sourceSubject = typeof source?.subject === 'string' ? source.subject : undefined;
      const sourceBody = typeof source?.body === 'string' ? source.body : undefined;

      const normalized = normalizeReminderTemplate(locale, level, {
        subject: sourceSubject ?? fallback.subject,
        body: sourceBody ?? fallback.body,
      });

      templates[locale][level] = normalized;

      if (sourceSubject === undefined || sourceBody === undefined) {
        changed = true;
        continue;
      }

      if (normalized.subject !== sourceSubject || normalized.body !== sourceBody) {
        changed = true;
      }
    }
  }

  return { templates, changed };
}