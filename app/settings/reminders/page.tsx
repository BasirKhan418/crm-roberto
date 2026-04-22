'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';

import useSWR from 'swr';
import { useSearchParams } from 'next/navigation';
import { AlertTriangleIcon, BellIcon, FileTextIcon, Loader2Icon, MailIcon } from 'lucide-react';
import { toast } from 'sonner';

import { useLocale } from '@/components/providers/locale-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useAuthMe } from '@/hooks/useAuthMe';
import { resolveTranslatedError, translate } from '@/lib/i18n/messages';
import { cn } from '@/lib/utils';

type ReminderLevel = 'soft' | 'medium' | 'firm' | 'formalNotice';
type ReminderLocale = 'en' | 'fr';
type LateFeeType = 'fixed' | 'percentage';
type LateFeeApplyFrom = 'medium' | 'firm' | 'formalNotice';
type SectionKey = 'timing' | 'templates' | 'lateFees' | 'legalNotice';

interface ReminderLateFeeStageSettings {
  enabled: boolean;
  type: LateFeeType;
  value: number;
}

interface ReminderLateFeeLegacySettings {
  enabled?: boolean;
  type?: LateFeeType;
  value?: number;
  applyFrom?: LateFeeApplyFrom;
  stages?: Partial<Record<ReminderLevel, Partial<ReminderLateFeeStageSettings>>>;
}

interface ReminderTemplateContent {
  subject: string;
  body: string;
}

type ReminderLocaleTemplates = Record<ReminderLevel, ReminderTemplateContent>;

interface ReminderSettingsData {
  offsets: {
    soft: number;
    medium: number;
    firm: number;
    formalNotice: number;
  };
  templates: {
    en: ReminderLocaleTemplates;
    fr: ReminderLocaleTemplates;
  };
  messageLocale: 'auto' | 'en' | 'fr';
  lateFee: {
    stages: Record<ReminderLevel, ReminderLateFeeStageSettings>;
  };
  legalNotice: {
    delayDays: 8 | 15;
    includeInterestClause: boolean;
    customFooter: string | null;
  };
}

interface ReminderSettingsApiResponse {
  success: boolean;
  message?: string;
  data?: Partial<Omit<ReminderSettingsData, 'lateFee'>> & { lateFee?: ReminderLateFeeLegacySettings };
}

type ReminderSettingsInput = Partial<Omit<ReminderSettingsData, 'lateFee'>> & { lateFee?: ReminderLateFeeLegacySettings };

const LEVELS: ReminderLevel[] = ['soft', 'medium', 'firm', 'formalNotice'];

const LATE_FEE_LEVEL_ORDER: Record<ReminderLevel, 1 | 2 | 3 | 4> = {
  soft: 1,
  medium: 2,
  firm: 3,
  formalNotice: 4,
};

const LATE_FEE_APPLY_FROM_ORDER: Record<LateFeeApplyFrom, 2 | 3 | 4> = {
  medium: 2,
  firm: 3,
  formalNotice: 4,
};

const DEFAULT_LATE_FEE_STAGE: ReminderLateFeeStageSettings = {
  enabled: false,
  type: 'percentage',
  value: 0,
};

const DEFAULT_SETTINGS: ReminderSettingsData = {
  offsets: {
    soft: 7,
    medium: 15,
    firm: 30,
    formalNotice: 35,
  },
  templates: {
    en: {
      soft: { subject: '', body: '' },
      medium: { subject: '', body: '' },
      firm: { subject: '', body: '' },
      formalNotice: { subject: '', body: '' },
    },
    fr: {
      soft: { subject: '', body: '' },
      medium: { subject: '', body: '' },
      firm: { subject: '', body: '' },
      formalNotice: { subject: '', body: '' },
    },
  },
  messageLocale: 'auto',
  lateFee: {
    stages: {
      soft: { ...DEFAULT_LATE_FEE_STAGE },
      medium: { ...DEFAULT_LATE_FEE_STAGE },
      firm: { ...DEFAULT_LATE_FEE_STAGE },
      formalNotice: { ...DEFAULT_LATE_FEE_STAGE },
    },
  },
  legalNotice: {
    delayDays: 8,
    includeInterestClause: true,
    customFooter: null,
  },
};

const TEMPLATE_SAMPLE_VARIABLES: Record<string, string> = {
  clientName: 'Jean Dupont',
  companyName: 'Atelier Roberto',
  invoiceNumber: 'INV-2024-001',
  invoiceDate: '07/01/2025',
  dueDate: '15/01/2025',
  daysOverdue: '6',
  amountDue: '1 234,00 €',
  amountOriginal: '1 234,00 €',
  lateFees: '35,00 €',
  paymentLink: 'https://pay.example.com/inv-2024-001',
  legalDeadline: '30/01/2025',
};

const TEMPLATE_VARIABLE_PATTERN = /\{\{(\w+)\}\}/g;

const DEFAULT_TEMPLATE_TAB: Record<ReminderLevel, ReminderLocale> = {
  soft: 'en',
  medium: 'en',
  firm: 'en',
  formalNotice: 'en',
};

const DEFAULT_LEVEL_LOADING_STATE: Record<ReminderLevel, boolean> = {
  soft: false,
  medium: false,
  firm: false,
  formalNotice: false,
};

const reminderSettingsPageChrome = {
  en: {
    chooseSection: 'Choose a section',
    sections: {
      timing: 'Reminder schedule',
      templates: 'Email templates',
      lateFees: 'Late fees',
      legalNotice: 'Legal notice',
    },
    timingEyebrow: 'Reminder flow',
    timingSummary: 'Set when each reminder is sent and which language should be used by default.',
    templatesEyebrow: 'Email content',
    templatesSummary: 'Edit one reminder email at a time in plain language.',
    lateFeesEyebrow: 'Charges',
    lateFeesSummary: 'Configure overdue charges independently for each reminder step.',
    legalNoticeEyebrow: 'Legal notice',
    legalNoticeSummary: 'Set the formal notice delay and any legal footer text.',
    templateLevelLabel: 'Which reminder email do you want to edit?',
    templateLevelHelp: 'Choose the reminder step and the language your customer will receive.',
    templateLocaleLabel: 'Email language',
    templateIntroTitle: 'What this email is for',
    templateIntroText: 'Use this message for the selected reminder step. Customer and invoice details are filled in automatically for each send.',
    smartFieldsButton: 'Add or remove automatic details',
    smartFieldsTitle: 'Manage automatic details',
    smartFieldsDescription: 'Use these buttons to add a detail to the end of the subject or message, or remove it from one of those areas.',
    smartFieldsAddHelpTitle: 'What “add” does',
    smartFieldsAddHelpText: 'Adds this detail to the end of the selected area so it is filled in automatically when the email is sent.',
    smartFieldsRemoveHelpTitle: 'What “remove” does',
    smartFieldsRemoveHelpText: 'Removes this detail from the selected area only. It does not change the customer or invoice data itself.',
    addToSubject: 'Add to subject',
    addToBody: 'Add to message',
    removeFromSubject: 'Remove from subject',
    removeFromBody: 'Remove from message',
    alreadyInSubject: 'Already in subject',
    alreadyInBody: 'Already in message',
    notInSubject: 'Not in subject',
    notInBody: 'Not in message',
    templateFieldHelp: 'You can change the wording. Items in brackets are automatic and cannot be edited.',
    automaticFieldsInlineTitle: 'Automatic details included',
    automaticFieldsInlineText: 'These details are still sent with the email. Use the button below if you want to add one or remove one clearly.',
    previewTitle: 'Customer preview',
    previewText: 'Preview with sample customer and invoice details.',
    smartFieldLabels: {
      clientName: 'Customer name',
      companyName: 'Company name',
      invoiceNumber: 'Invoice number',
      invoiceDate: 'Invoice date',
      dueDate: 'Due date',
      daysOverdue: 'Days overdue',
      amountDue: 'Amount due',
      amountOriginal: 'Original amount',
      lateFees: 'Late fees',
      paymentLink: 'Payment link',
      legalDeadline: 'Legal deadline',
    },
  },
  fr: {
    chooseSection: 'Choisissez une section',
    sections: {
      timing: 'Calendrier de relance',
      templates: 'Modèles d\'e-mail',
      lateFees: 'Pénalités',
      legalNotice: 'Mise en demeure',
    },
    timingEyebrow: 'Flux de relance',
    timingSummary: 'Définissez quand chaque relance est envoyée et la langue utilisée par défaut.',
    templatesEyebrow: 'Contenu e-mail',
    templatesSummary: 'Modifiez un e-mail de relance à la fois avec une interface plus simple.',
    lateFeesEyebrow: 'Pénalités',
    lateFeesSummary: 'Configurez les pénalités de retard indépendamment pour chaque étape de relance.',
    legalNoticeEyebrow: 'Mise en demeure',
    legalNoticeSummary: 'Réglez le délai de mise en demeure et le texte juridique complémentaire.',
    templateLevelLabel: 'Quel e-mail de relance souhaitez-vous modifier ?',
    templateLevelHelp: 'Choisissez l\'étape de relance et la langue que votre client recevra.',
    templateLocaleLabel: 'Langue de l\'e-mail',
    templateIntroTitle: 'A quoi sert cet e-mail',
    templateIntroText: 'Ce message sera utilisé pour l\'étape de relance choisie. Les détails client et facture sont ajoutés automatiquement à chaque envoi.',
    smartFieldsButton: 'Ajouter ou retirer des détails automatiques',
    smartFieldsTitle: 'Gérer les détails automatiques',
    smartFieldsDescription: 'Utilisez ces boutons pour ajouter un détail à la fin du sujet ou du message, ou le retirer de l\'une de ces zones.',
    smartFieldsAddHelpTitle: 'Ce que fait “ajouter”',
    smartFieldsAddHelpText: 'Ajoute ce détail à la fin de la zone choisie afin qu\'il soit rempli automatiquement lors de l\'envoi.',
    smartFieldsRemoveHelpTitle: 'Ce que fait “retirer”',
    smartFieldsRemoveHelpText: 'Retire ce détail de la zone choisie uniquement. Cela ne change pas les données client ou facture.',
    addToSubject: 'Ajouter au sujet',
    addToBody: 'Ajouter au message',
    removeFromSubject: 'Retirer du sujet',
    removeFromBody: 'Retirer du message',
    alreadyInSubject: 'Déjà dans le sujet',
    alreadyInBody: 'Déjà dans le message',
    notInSubject: 'Absent du sujet',
    notInBody: 'Absent du message',
    templateFieldHelp: 'Vous pouvez modifier le texte. Les éléments entre crochets sont automatiques et ne peuvent pas être modifiés.',
    automaticFieldsInlineTitle: 'Détails automatiques inclus',
    automaticFieldsInlineText: 'Ces détails seront toujours envoyés dans l\'e-mail. Utilisez le bouton ci-dessous si vous voulez en ajouter un ou en retirer un clairement.',
    previewTitle: 'Aperçu client',
    previewText: 'Aperçu avec des exemples de client et de facture.',
    smartFieldLabels: {
      clientName: 'Nom du client',
      companyName: 'Nom de l\'entreprise',
      invoiceNumber: 'Numéro de facture',
      invoiceDate: 'Date de facture',
      dueDate: 'Date d\'échéance',
      daysOverdue: 'Jours de retard',
      amountDue: 'Montant dû',
      amountOriginal: 'Montant initial',
      lateFees: 'Pénalités',
      paymentLink: 'Lien de paiement',
      legalDeadline: 'Date limite légale',
    },
  },
} as const;

function isSectionKey(value: string | null): value is SectionKey {
  return value === 'timing' || value === 'templates' || value === 'lateFees' || value === 'legalNotice';
}

function replaceTemplateVariables(template: string): string {
  return template.replace(TEMPLATE_VARIABLE_PATTERN, (_full, variable: string) => {
    return TEMPLATE_SAMPLE_VARIABLES[variable] ?? '';
  });
}

function extractTemplateVariablesInOrder(template: string): string[] {
  return Array.from(template.matchAll(TEMPLATE_VARIABLE_PATTERN), ([, variable]) => variable);
}

function buildLockedMarker(variable: string, labels: Record<string, string>): string {
  return `[${labels[variable] ?? variable}]`;
}

function toEditableTemplate(template: string, labels: Record<string, string>): string {
  return template.replace(TEMPLATE_VARIABLE_PATTERN, (_full, variable: string) => buildLockedMarker(variable, labels));
}

function countOccurrences(value: string, fragment: string): number {
  if (!fragment) {
    return 0;
  }

  let count = 0;
  let cursor = 0;

  while (cursor <= value.length) {
    const index = value.indexOf(fragment, cursor);
    if (index === -1) {
      break;
    }

    count += 1;
    cursor = index + fragment.length;
  }

  return count;
}

function rebuildTemplateFromEditable(
  editableValue: string,
  originalTemplate: string,
  labels: Record<string, string>
): string {
  const variables = extractTemplateVariablesInOrder(originalTemplate);
  if (variables.length === 0) {
    return editableValue;
  }

  let remainder = editableValue;
  let rebuilt = '';

  for (const variable of variables) {
    const marker = buildLockedMarker(variable, labels);
    const markerIndex = remainder.indexOf(marker);

    if (markerIndex === -1) {
      return originalTemplate;
    }

    rebuilt += remainder.slice(0, markerIndex);
    rebuilt += `{{${variable}}}`;
    remainder = remainder.slice(markerIndex + marker.length);
  }

  return rebuilt + remainder;
}

function hasVariableToken(template: string, variable: string): boolean {
  return template.includes(`{{${variable}}}`);
}

function addVariableToken(template: string, variable: string, field: 'subject' | 'body'): string {
  const token = `{{${variable}}}`;
  if (template.includes(token)) {
    return template;
  }

  if (!template.trim()) {
    return token;
  }

  if (field === 'subject') {
    return `${template.trimEnd()} ${token}`;
  }

  return `${template.replace(/\s+$/u, '')}\n${token}`;
}

function removeVariableToken(template: string, variable: string, field: 'subject' | 'body'): string {
  const token = `{{${variable}}}`;
  const withoutToken = template.replaceAll(token, '');

  if (field === 'subject') {
    return withoutToken.replace(/\s{2,}/g, ' ').trim();
  }

  return withoutToken.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function normalizeSettings(input?: ReminderSettingsInput): ReminderSettingsData {
  const legacyLateFee = input?.lateFee;
  const lateFeeStages = legacyLateFee?.stages;
  const legacyEnabled = legacyLateFee?.enabled === true;
  const legacyType: LateFeeType = legacyLateFee?.type === 'fixed' ? 'fixed' : 'percentage';
  const legacyValue = Math.max(0, Number(legacyLateFee?.value ?? 0));
  const legacyThreshold = LATE_FEE_APPLY_FROM_ORDER[legacyLateFee?.applyFrom ?? 'formalNotice'];

  const normalizeLateFeeStage = (
    level: ReminderLevel,
    explicitStage?: Partial<ReminderLateFeeStageSettings>
  ): ReminderLateFeeStageSettings => {
    if (lateFeeStages) {
      return {
        enabled: explicitStage?.enabled === true,
        type: explicitStage?.type === 'fixed' ? 'fixed' : 'percentage',
        value: Math.max(0, Number(explicitStage?.value ?? 0)),
      };
    }

    if (level === 'soft') {
      return { ...DEFAULT_LATE_FEE_STAGE };
    }

    return {
      enabled: legacyEnabled && LATE_FEE_LEVEL_ORDER[level] >= legacyThreshold,
      type: legacyType,
      value: legacyValue,
    };
  };

  return {
    offsets: {
      soft: input?.offsets?.soft ?? DEFAULT_SETTINGS.offsets.soft,
      medium: input?.offsets?.medium ?? DEFAULT_SETTINGS.offsets.medium,
      firm: input?.offsets?.firm ?? DEFAULT_SETTINGS.offsets.firm,
      formalNotice: input?.offsets?.formalNotice ?? DEFAULT_SETTINGS.offsets.formalNotice,
    },
    templates: {
      en: {
        soft: {
          subject: input?.templates?.en?.soft?.subject ?? DEFAULT_SETTINGS.templates.en.soft.subject,
          body: input?.templates?.en?.soft?.body ?? DEFAULT_SETTINGS.templates.en.soft.body,
        },
        medium: {
          subject: input?.templates?.en?.medium?.subject ?? DEFAULT_SETTINGS.templates.en.medium.subject,
          body: input?.templates?.en?.medium?.body ?? DEFAULT_SETTINGS.templates.en.medium.body,
        },
        firm: {
          subject: input?.templates?.en?.firm?.subject ?? DEFAULT_SETTINGS.templates.en.firm.subject,
          body: input?.templates?.en?.firm?.body ?? DEFAULT_SETTINGS.templates.en.firm.body,
        },
        formalNotice: {
          subject: input?.templates?.en?.formalNotice?.subject ?? DEFAULT_SETTINGS.templates.en.formalNotice.subject,
          body: input?.templates?.en?.formalNotice?.body ?? DEFAULT_SETTINGS.templates.en.formalNotice.body,
        },
      },
      fr: {
        soft: {
          subject: input?.templates?.fr?.soft?.subject ?? DEFAULT_SETTINGS.templates.fr.soft.subject,
          body: input?.templates?.fr?.soft?.body ?? DEFAULT_SETTINGS.templates.fr.soft.body,
        },
        medium: {
          subject: input?.templates?.fr?.medium?.subject ?? DEFAULT_SETTINGS.templates.fr.medium.subject,
          body: input?.templates?.fr?.medium?.body ?? DEFAULT_SETTINGS.templates.fr.medium.body,
        },
        firm: {
          subject: input?.templates?.fr?.firm?.subject ?? DEFAULT_SETTINGS.templates.fr.firm.subject,
          body: input?.templates?.fr?.firm?.body ?? DEFAULT_SETTINGS.templates.fr.firm.body,
        },
        formalNotice: {
          subject: input?.templates?.fr?.formalNotice?.subject ?? DEFAULT_SETTINGS.templates.fr.formalNotice.subject,
          body: input?.templates?.fr?.formalNotice?.body ?? DEFAULT_SETTINGS.templates.fr.formalNotice.body,
        },
      },
    },
    messageLocale: input?.messageLocale ?? DEFAULT_SETTINGS.messageLocale,
    lateFee: {
      stages: {
        soft: normalizeLateFeeStage('soft', lateFeeStages?.soft),
        medium: normalizeLateFeeStage('medium', lateFeeStages?.medium),
        firm: normalizeLateFeeStage('firm', lateFeeStages?.firm),
        formalNotice: normalizeLateFeeStage('formalNotice', lateFeeStages?.formalNotice),
      },
    },
    legalNotice: {
      delayDays: input?.legalNotice?.delayDays ?? DEFAULT_SETTINGS.legalNotice.delayDays,
      includeInterestClause: input?.legalNotice?.includeInterestClause ?? DEFAULT_SETTINGS.legalNotice.includeInterestClause,
      customFooter: input?.legalNotice?.customFooter ?? DEFAULT_SETTINGS.legalNotice.customFooter,
    },
  };
}

function hasValidOffsets(
  offsets?: Partial<ReminderSettingsData['offsets']> | null
) {
  if (!offsets) {
    return false;
  }

  const soft = Number(offsets.soft);
  const medium = Number(offsets.medium);
  const firm = Number(offsets.firm);
  const formalNotice = Number(offsets.formalNotice);

  if (![soft, medium, firm, formalNotice].every(Number.isFinite)) {
    return false;
  }

  return soft < medium && medium < firm && firm <= formalNotice;
}

function SectionPickerButton({
  active,
  title,
  description,
  icon,
  onClick,
}: {
  active: boolean;
  title: string;
  description: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-2xl border p-4 text-left transition-colors',
        active
          ? 'border-primary/30 bg-primary/8 text-foreground'
          : 'border-border/70 bg-background/90 hover:border-primary/30 hover:bg-primary/5'
      )}
    >
      <div className="mb-3 inline-flex size-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
        {icon}
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
    </button>
  );
}

function SettingsSectionCard({
  eyebrow,
  title,
  description,
  icon,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader className="space-y-3 border-b border-border/60 bg-muted/15 p-5 pb-4 sm:space-y-4 sm:pb-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="inline-flex size-11 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
              {icon}
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{eyebrow}</p>
              <CardTitle className="text-xl">{title}</CardTitle>
              <CardDescription className="max-w-3xl text-sm leading-6">{description}</CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 p-5 pt-5 sm:space-y-6">{children}</CardContent>
    </Card>
  );
}

interface ReminderSettingsPageProps {
  embedded?: boolean;
  lockedSection?: SectionKey;
}

export default function ReminderSettingsPage({ embedded = false, lockedSection }: ReminderSettingsPageProps = {}) {
  const searchParams = useSearchParams();
  const { locale } = useLocale();
  const { user, loading: authLoading } = useAuthMe();

  const [draft, setDraft] = useState<ReminderSettingsData>(DEFAULT_SETTINGS);
  const [activeSection, setActiveSection] = useState<SectionKey>('timing');
  const [timingSaving, setTimingSaving] = useState(false);
  const [templateSaving, setTemplateSaving] = useState<Record<ReminderLevel, boolean>>(DEFAULT_LEVEL_LOADING_STATE);
  const [templateResetting, setTemplateResetting] = useState<Record<ReminderLevel, boolean>>(DEFAULT_LEVEL_LOADING_STATE);
  const [templateTabs, setTemplateTabs] = useState<Record<ReminderLevel, ReminderLocale>>(DEFAULT_TEMPLATE_TAB);
  const [activeTemplateLevel, setActiveTemplateLevel] = useState<ReminderLevel>('soft');
  const [lateFeeSaving, setLateFeeSaving] = useState(false);
  const [legalNoticeSaving, setLegalNoticeSaving] = useState(false);

  const t = (key: string, replacements?: Record<string, string | number | null | undefined>) =>
    translate(locale, key, replacements);
  const pageChrome = reminderSettingsPageChrome[locale];

  const fetchSettings = async (url: string) => {
    const response = await fetch(url, { cache: 'no-store' });
    const payload = (await response.json()) as ReminderSettingsApiResponse;

    if (!response.ok || !payload.success) {
      throw new Error(payload.message || t('reminders.settings.loadFailed'));
    }

    return normalizeSettings(payload.data);
  };

  const {
    data: settings,
    error: settingsError,
    isLoading,
    mutate,
  } = useSWR<ReminderSettingsData>(!authLoading && user ? '/api/reminders/settings' : null, fetchSettings);

  useEffect(() => {
    if (settings) {
      setDraft(normalizeSettings(settings));
    }
  }, [settings]);

  useEffect(() => {
    if (lockedSection) {
      setActiveSection(lockedSection);
      return;
    }

    const sectionParam = searchParams.get('section');
    if (isSectionKey(sectionParam)) {
      setActiveSection(sectionParam);
    }
  }, [lockedSection, searchParams]);

  const timingInvalid = useMemo(() => !hasValidOffsets(draft.offsets), [draft.offsets]);

  async function patchSettings(patch: Record<string, unknown>) {
    const response = await fetch('/api/reminders/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });

    const payload = (await response.json()) as ReminderSettingsApiResponse;

    if (!response.ok || !payload.success) {
      throw new Error(payload.message || t('reminders.settings.saveFailedGeneric'));
    }

    const normalized = normalizeSettings(payload.data);
    setDraft(normalized);
    await mutate(normalized, false);
  }

  async function handleSaveTiming() {
    if (timingInvalid) {
      toast.error(t('reminders.settings.timing.invalidToast'));
      return;
    }

    setTimingSaving(true);
    try {
      await patchSettings({ offsets: draft.offsets, messageLocale: draft.messageLocale });
      toast.success(t('reminders.settings.timing.savedToast'));
    } catch (error) {
      toast.error(resolveTranslatedError(locale, error, t('reminders.settings.saveFailedGeneric')));
    } finally {
      setTimingSaving(false);
    }
  }

  async function handleSaveTemplate(level: ReminderLevel) {
    setTemplateSaving((prev) => ({ ...prev, [level]: true }));

    try {
      await patchSettings({
        templates: {
          en: {
            [level]: {
              subject: draft.templates.en[level].subject,
              body: draft.templates.en[level].body,
            },
          },
          fr: {
            [level]: {
              subject: draft.templates.fr[level].subject,
              body: draft.templates.fr[level].body,
            },
          },
        },
      });
      toast.success(t('reminders.settings.templates.savedToast', { level: t(`reminders.levels.${level}`) }));
    } catch (error) {
      toast.error(resolveTranslatedError(locale, error, t('reminders.settings.templates.saveFailed')));
    } finally {
      setTemplateSaving((prev) => ({ ...prev, [level]: false }));
    }
  }

  async function handleResetTemplates(level: ReminderLevel) {
    setTemplateResetting((prev) => ({ ...prev, [level]: true }));

    try {
      const response = await fetch('/api/reminders/settings/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section: 'templates' }),
      });

      const payload = (await response.json()) as ReminderSettingsApiResponse;
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || t('reminders.settings.templates.resetFailed'));
      }

      const normalized = normalizeSettings(payload.data);
      setDraft(normalized);
      await mutate(normalized, false);
      toast.success(t('reminders.settings.templates.resetToast', { level: t(`reminders.levels.${level}`) }));
    } catch (error) {
      toast.error(resolveTranslatedError(locale, error, t('reminders.settings.templates.resetFailed')));
    } finally {
      setTemplateResetting((prev) => ({ ...prev, [level]: false }));
    }
  }

  async function handleSaveLateFees() {
    setLateFeeSaving(true);
    try {
      await patchSettings({ lateFee: draft.lateFee });
      toast.success(t('reminders.settings.lateFees.savedToast'));
    } catch (error) {
      toast.error(resolveTranslatedError(locale, error, t('reminders.settings.saveFailedGeneric')));
    } finally {
      setLateFeeSaving(false);
    }
  }

  async function handleSaveLegalNotice() {
    setLegalNoticeSaving(true);
    try {
      await patchSettings({ legalNotice: draft.legalNotice });
      toast.success(t('reminders.settings.legalNoticeSection.savedToast'));
    } catch (error) {
      toast.error(resolveTranslatedError(locale, error, t('reminders.settings.saveFailedGeneric')));
    } finally {
      setLegalNoticeSaving(false);
    }
  }

  if (authLoading || isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2Icon className="size-4 animate-spin" />
          {t('reminders.settings.loading')}
        </CardContent>
      </Card>
    );
  }

  if (!user) {
    return (
      <Card>
        <CardContent className="py-8 text-sm text-muted-foreground">{t('reminders.settings.authRequired')}</CardContent>
      </Card>
    );
  }

  if (settingsError) {
    return (
      <Card>
        <CardContent className="space-y-3 py-8">
          <p className="text-sm text-destructive">{resolveTranslatedError(locale, settingsError, t('reminders.settings.loadFailed'))}</p>
          <Button type="button" onClick={() => void mutate()}>
            {t('reminders.settings.retry')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const activeTemplateLocale = templateTabs[activeTemplateLevel];
  const activeTemplate = draft.templates[activeTemplateLocale][activeTemplateLevel];
  const editableSubject = toEditableTemplate(activeTemplate.subject, pageChrome.smartFieldLabels);
  const editableBody = toEditableTemplate(activeTemplate.body, pageChrome.smartFieldLabels);
  const activeTemplateVariables = Array.from(
    new Set([
      ...extractTemplateVariablesInOrder(activeTemplate.subject),
      ...extractTemplateVariablesInOrder(activeTemplate.body),
    ])
  );

  function handleTemplateFieldChange(field: 'subject' | 'body', nextValue: string) {
    const originalValue = draft.templates[activeTemplateLocale][activeTemplateLevel][field];
    const currentDisplayValue = toEditableTemplate(originalValue, pageChrome.smartFieldLabels);
    const markers = extractTemplateVariablesInOrder(originalValue).map((variable) => buildLockedMarker(variable, pageChrome.smartFieldLabels));

    const markerCountsAreStable = Array.from(new Set(markers)).every(
      (marker) => countOccurrences(nextValue, marker) === countOccurrences(currentDisplayValue, marker)
    );

    if (!markerCountsAreStable) {
      return;
    }

    const rebuiltValue = rebuildTemplateFromEditable(nextValue, originalValue, pageChrome.smartFieldLabels);

    setDraft((prev) => ({
      ...prev,
      templates: {
        ...prev.templates,
        [activeTemplateLocale]: {
          ...prev.templates[activeTemplateLocale],
          [activeTemplateLevel]: {
            ...prev.templates[activeTemplateLocale][activeTemplateLevel],
            [field]: rebuiltValue,
          },
        },
      },
    }));
  }

  function handleVariableAction(field: 'subject' | 'body', variable: string, action: 'add' | 'remove') {
    setDraft((prev) => {
      const currentValue = prev.templates[activeTemplateLocale][activeTemplateLevel][field];
      const nextValue =
        action === 'add'
          ? addVariableToken(currentValue, variable, field)
          : removeVariableToken(currentValue, variable, field);

      return {
        ...prev,
        templates: {
          ...prev.templates,
          [activeTemplateLocale]: {
            ...prev.templates[activeTemplateLocale],
            [activeTemplateLevel]: {
              ...prev.templates[activeTemplateLocale][activeTemplateLevel],
              [field]: nextValue,
            },
          },
        },
      };
    });
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      {!embedded ? (
        <div className="space-y-1">
          <h2 className="font-heading text-xl font-semibold tracking-tight">{t('reminders.settings.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('reminders.settings.description')}</p>
        </div>
      ) : null}

      {!lockedSection ? (
        <div className="space-y-3 rounded-3xl border border-border/70 bg-linear-to-br from-background via-background to-muted/30 p-4 shadow-sm sm:p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{pageChrome.chooseSection}</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SectionPickerButton
              active={activeSection === 'timing'}
              title={pageChrome.sections.timing}
              description={pageChrome.timingSummary}
              icon={<BellIcon className="size-4" />}
              onClick={() => setActiveSection('timing')}
            />
            <SectionPickerButton
              active={activeSection === 'templates'}
              title={pageChrome.sections.templates}
              description={pageChrome.templatesSummary}
              icon={<MailIcon className="size-4" />}
              onClick={() => setActiveSection('templates')}
            />
            <SectionPickerButton
              active={activeSection === 'lateFees'}
              title={pageChrome.sections.lateFees}
              description={pageChrome.lateFeesSummary}
              icon={<AlertTriangleIcon className="size-4" />}
              onClick={() => setActiveSection('lateFees')}
            />
            <SectionPickerButton
              active={activeSection === 'legalNotice'}
              title={pageChrome.sections.legalNotice}
              description={pageChrome.legalNoticeSummary}
              icon={<FileTextIcon className="size-4" />}
              onClick={() => setActiveSection('legalNotice')}
            />
          </div>
        </div>
      ) : null}

      {activeSection === 'timing' ? (
        <SettingsSectionCard
          eyebrow={pageChrome.timingEyebrow}
          title={t('reminders.settings.offsets')}
          description={t('reminders.settings.timing.description')}
          icon={<BellIcon className="size-5" />}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {LEVELS.map((level) => (
              <div key={level} className="space-y-2">
                <Label htmlFor={`offset-${level}`}>{t(`reminders.settings.timing.fields.${level}`)}</Label>
                <Input
                  id={`offset-${level}`}
                  type="number"
                  min={1}
                  value={draft.offsets[level]}
                  onChange={(event) => {
                    const next = Number(event.target.value);
                    if (!Number.isFinite(next)) {
                      return;
                    }
                    setDraft((prev) => ({
                      ...prev,
                      offsets: {
                        ...prev.offsets,
                        [level]: next,
                      },
                    }));
                  }}
                />
              </div>
            ))}
          </div>

          <p className={cn('text-xs', timingInvalid ? 'text-destructive' : 'text-muted-foreground')}>
            {t('reminders.settings.timing.validationRule')}
          </p>

          <div className="space-y-2">
            <Label>{t('reminders.settings.language.label')}</Label>
            <Select
              value={draft.messageLocale}
              onValueChange={(value) => {
                const nextLocale: 'auto' | 'en' | 'fr' = value === 'en' || value === 'fr' ? value : 'auto';
                setDraft((prev) => ({
                  ...prev,
                  messageLocale: nextLocale,
                }));
              }}
            >
              <SelectTrigger className="h-11 w-full sm:max-w-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">{t('reminders.settings.language.auto')}</SelectItem>
                <SelectItem value="en">{t('reminders.settings.language.english')}</SelectItem>
                <SelectItem value="fr">{t('reminders.settings.language.french')}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{t('reminders.settings.language.help')}</p>
          </div>

          <Button type="button" className="w-full sm:w-auto" disabled={timingSaving} onClick={() => void handleSaveTiming()}>
            {timingSaving ? <Loader2Icon className="size-4 animate-spin" /> : null}
            {timingSaving ? t('reminders.settings.common.saving') : t('reminders.settings.timing.saveButton')}
          </Button>
        </SettingsSectionCard>
      ) : null}

      {activeSection === 'templates' ? (
        <SettingsSectionCard
          eyebrow={pageChrome.templatesEyebrow}
          title={t('reminders.settings.templatesTitle')}
          description={t('reminders.settings.templatesSectionDescription')}
          icon={<MailIcon className="size-5" />}
        >
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
            <div className="space-y-4">
              <div className="space-y-4 rounded-2xl border border-border/70 bg-muted/15 p-4 sm:p-5">
                <div className="space-y-1">
                  <p className="text-sm font-medium">{pageChrome.templateIntroTitle}</p>
                  <p className="text-sm text-muted-foreground">{pageChrome.templateIntroText}</p>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{pageChrome.templateLevelLabel}</Label>
                    <Select value={activeTemplateLevel} onValueChange={(value) => setActiveTemplateLevel((LEVELS.includes(value as ReminderLevel) ? value : 'soft') as ReminderLevel)}>
                      <SelectTrigger className="h-11 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LEVELS.map((level) => (
                          <SelectItem key={level} value={level}>
                            {t(`reminders.levels.${level}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">{pageChrome.templateLevelHelp}</p>
                  </div>

                  <div className="space-y-2">
                    <Label>{pageChrome.templateLocaleLabel}</Label>
                    <Select
                      value={activeTemplateLocale}
                      onValueChange={(value) => {
                        const nextLocale: ReminderLocale = value === 'fr' ? 'fr' : 'en';
                        setTemplateTabs((prev) => ({ ...prev, [activeTemplateLevel]: nextLocale }));
                      }}
                    >
                      <SelectTrigger className="h-11 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">{t('reminders.settings.templates.tab.en')}</SelectItem>
                        <SelectItem value="fr">{t('reminders.settings.templates.tab.fr')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="space-y-2 rounded-2xl border border-border/70 bg-background p-4 sm:p-5">
                <Label htmlFor="template-subject">{t('reminders.settings.templates.subject')}</Label>
                <Input
                  id="template-subject"
                  value={editableSubject}
                  onChange={(event) => handleTemplateFieldChange('subject', event.target.value)}
                  placeholder={t('reminders.settings.templates.subjectPlaceholder')}
                />
                <p className="text-xs text-muted-foreground">{pageChrome.templateFieldHelp}</p>
              </div>

              <div className="space-y-2 rounded-2xl border border-border/70 bg-background p-4 sm:p-5">
                <Label htmlFor="template-body">{t('reminders.settings.templates.body')}</Label>
                <Textarea
                  id="template-body"
                  rows={12}
                  value={editableBody}
                  onChange={(event) => handleTemplateFieldChange('body', event.target.value)}
                  placeholder={t('reminders.settings.templates.bodyPlaceholder')}
                />
                <p className="text-xs text-muted-foreground">{pageChrome.templateFieldHelp}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-border/70 bg-muted/15 p-4 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{pageChrome.automaticFieldsInlineTitle}</p>
                    <p className="text-sm text-muted-foreground">{pageChrome.automaticFieldsInlineText}</p>
                  </div>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button type="button" variant="outline" className="w-full sm:w-auto">
                        {pageChrome.smartFieldsButton}
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-2xl lg:max-w-3xl">
                      <DialogHeader>
                        <DialogTitle>{pageChrome.smartFieldsTitle}</DialogTitle>
                        <DialogDescription>{pageChrome.smartFieldsDescription}</DialogDescription>
                      </DialogHeader>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="rounded-xl border border-border/70 bg-muted/15 p-3">
                          <p className="text-sm font-medium">{pageChrome.smartFieldsAddHelpTitle}</p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">{pageChrome.smartFieldsAddHelpText}</p>
                        </div>
                        <div className="rounded-xl border border-border/70 bg-muted/15 p-3">
                          <p className="text-sm font-medium">{pageChrome.smartFieldsRemoveHelpTitle}</p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">{pageChrome.smartFieldsRemoveHelpText}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {Object.entries(TEMPLATE_SAMPLE_VARIABLES).map(([name, value]) => (
                          <div key={name} className="rounded-xl border border-border/70 p-3">
                            <p className="text-sm font-medium">{pageChrome.smartFieldLabels[name as keyof typeof pageChrome.smartFieldLabels]}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{value}</p>
                            <div className="mt-3 grid grid-cols-1 gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                className="h-auto w-full justify-between gap-2 whitespace-normal py-2 text-left"
                                onClick={() => handleVariableAction('subject', name, 'add')}
                                disabled={hasVariableToken(activeTemplate.subject, name)}
                              >
                                <span className="min-w-0 flex-1 wrap-break-word">{pageChrome.addToSubject}</span>
                                <span className="shrink-0 text-xs text-muted-foreground">
                                  {hasVariableToken(activeTemplate.subject, name) ? pageChrome.alreadyInSubject : pageChrome.notInSubject}
                                </span>
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                className="h-auto w-full justify-between gap-2 whitespace-normal py-2 text-left"
                                onClick={() => handleVariableAction('body', name, 'add')}
                                disabled={hasVariableToken(activeTemplate.body, name)}
                              >
                                <span className="min-w-0 flex-1 wrap-break-word">{pageChrome.addToBody}</span>
                                <span className="shrink-0 text-xs text-muted-foreground">
                                  {hasVariableToken(activeTemplate.body, name) ? pageChrome.alreadyInBody : pageChrome.notInBody}
                                </span>
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                className="h-auto w-full justify-between gap-2 whitespace-normal py-2 text-left"
                                onClick={() => handleVariableAction('subject', name, 'remove')}
                                disabled={!hasVariableToken(activeTemplate.subject, name)}
                              >
                                <span className="min-w-0 flex-1 wrap-break-word">{pageChrome.removeFromSubject}</span>
                                <span className="shrink-0 text-xs text-muted-foreground">
                                  {hasVariableToken(activeTemplate.subject, name) ? pageChrome.alreadyInSubject : pageChrome.notInSubject}
                                </span>
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                className="h-auto w-full justify-between gap-2 whitespace-normal py-2 text-left"
                                onClick={() => handleVariableAction('body', name, 'remove')}
                                disabled={!hasVariableToken(activeTemplate.body, name)}
                              >
                                <span className="min-w-0 flex-1 wrap-break-word">{pageChrome.removeFromBody}</span>
                                <span className="shrink-0 text-xs text-muted-foreground">
                                  {hasVariableToken(activeTemplate.body, name) ? pageChrome.alreadyInBody : pageChrome.notInBody}
                                </span>
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {activeTemplateVariables.map((variable) => (
                    <Badge key={variable} variant="outline" className="rounded-full px-3 py-1 text-xs">
                      {pageChrome.smartFieldLabels[variable as keyof typeof pageChrome.smartFieldLabels] ?? variable}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-border/70 bg-background p-4 sm:p-5">
                <div className="space-y-1">
                  <p className="text-sm font-medium">{pageChrome.previewTitle}</p>
                  <p className="text-sm text-muted-foreground">{pageChrome.previewText}</p>
                </div>
                <div className="mt-4 space-y-2 text-sm">
                  <p>
                    <span className="font-medium">{t('reminders.settings.templates.subject')}:</span>{' '}
                    {replaceTemplateVariables(activeTemplate.subject)}
                  </p>
                  <p className="font-medium">{t('reminders.settings.templates.body')}:</p>
                  <p className="whitespace-pre-wrap rounded-xl border border-border/70 bg-muted/15 p-3 text-sm">
                    {replaceTemplateVariables(activeTemplate.body)}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-background p-4 sm:p-5">
                <Button
                  type="button"
                  className="w-full"
                  onClick={() => void handleSaveTemplate(activeTemplateLevel)}
                  disabled={templateSaving[activeTemplateLevel]}
                >
                  {templateSaving[activeTemplateLevel] ? <Loader2Icon className="size-4 animate-spin" /> : null}
                  {templateSaving[activeTemplateLevel] ? t('reminders.settings.common.saving') : t('reminders.settings.templates.saveButton')}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => void handleResetTemplates(activeTemplateLevel)}
                  disabled={templateResetting[activeTemplateLevel]}
                >
                  {templateResetting[activeTemplateLevel] ? t('reminders.settings.common.resetting') : t('reminders.settings.templates.resetButton')}
                </Button>
              </div>
            </div>
          </div>
        </SettingsSectionCard>
      ) : null}

      {activeSection === 'lateFees' ? (
        <SettingsSectionCard
          eyebrow={pageChrome.lateFeesEyebrow}
          title={t('reminders.settings.lateFee')}
          description={t('reminders.settings.lateFees.description')}
          icon={<AlertTriangleIcon className="size-5" />}
        >
          <div className="space-y-4">
            <div className="rounded-2xl border border-border/70 bg-muted/15 p-4">
              <p className="text-sm text-muted-foreground">{t('reminders.settings.lateFees.stageHelp')}</p>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {LEVELS.map((level) => {
                const stage = draft.lateFee.stages[level];

                return (
                  <div key={level} className="space-y-4 rounded-2xl border border-border/70 bg-background p-4 sm:p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium">{t(`reminders.levels.${level}`)}</p>
                        <p className="text-xs text-muted-foreground">{t('reminders.settings.lateFees.enable')}</p>
                      </div>
                      <Switch
                        checked={stage.enabled}
                        onCheckedChange={(checked) => {
                          setDraft((prev) => ({
                            ...prev,
                            lateFee: {
                              ...prev.lateFee,
                              stages: {
                                ...prev.lateFee.stages,
                                [level]: {
                                  ...prev.lateFee.stages[level],
                                  enabled: checked,
                                },
                              },
                            },
                          }));
                        }}
                      />
                    </div>

                    {stage.enabled ? (
                      <>
                        <div className="space-y-2">
                          <Label>{t('reminders.settings.lateFees.type')}</Label>
                          <RadioGroup
                            value={stage.type}
                            onValueChange={(value) => {
                              const nextType: LateFeeType = value === 'fixed' ? 'fixed' : 'percentage';
                              setDraft((prev) => ({
                                ...prev,
                                lateFee: {
                                  ...prev.lateFee,
                                  stages: {
                                    ...prev.lateFee.stages,
                                    [level]: {
                                      ...prev.lateFee.stages[level],
                                      type: nextType,
                                    },
                                  },
                                },
                              }));
                            }}
                            className="grid grid-cols-1 gap-2"
                          >
                            <Label className="flex items-center gap-2 rounded-2xl border border-border/70 p-4 text-sm">
                              <RadioGroupItem value="fixed" />
                              {t('reminders.settings.lateFees.fixedAmount')}
                            </Label>
                            <Label className="flex items-center gap-2 rounded-2xl border border-border/70 p-4 text-sm">
                              <RadioGroupItem value="percentage" />
                              {t('reminders.settings.lateFees.percentage')}
                            </Label>
                          </RadioGroup>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`late-fee-value-${level}`}>{t('reminders.settings.lateFees.value')}</Label>
                          <Input
                            id={`late-fee-value-${level}`}
                            type="number"
                            min={0}
                            step="0.01"
                            value={stage.value}
                            onChange={(event) => {
                              const next = Number(event.target.value);
                              if (!Number.isFinite(next)) {
                                return;
                              }

                              setDraft((prev) => ({
                                ...prev,
                                lateFee: {
                                  ...prev.lateFee,
                                  stages: {
                                    ...prev.lateFee.stages,
                                    [level]: {
                                      ...prev.lateFee.stages[level],
                                      value: next,
                                    },
                                  },
                                },
                              }));
                            }}
                          />
                          <p className="text-xs text-muted-foreground">
                            {stage.type === 'fixed' ? t('reminders.settings.lateFees.valueHelpFixed') : t('reminders.settings.lateFees.valueHelpPercent')}
                          </p>
                        </div>
                      </>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <Button type="button" className="w-full sm:w-auto" disabled={lateFeeSaving} onClick={() => void handleSaveLateFees()}>
              {lateFeeSaving ? <Loader2Icon className="size-4 animate-spin" /> : null}
              {lateFeeSaving ? t('reminders.settings.common.saving') : t('reminders.settings.lateFees.saveButton')}
            </Button>
          </div>
        </SettingsSectionCard>
      ) : null}

      {activeSection === 'legalNotice' ? (
        <SettingsSectionCard
          eyebrow={pageChrome.legalNoticeEyebrow}
          title={t('reminders.settings.legalNotice')}
          description={t('reminders.settings.legalNoticeSection.description')}
          icon={<FileTextIcon className="size-5" />}
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('reminders.settings.legalNoticeSection.delay')}</Label>
              <RadioGroup
                value={String(draft.legalNotice.delayDays)}
                onValueChange={(value) => {
                  const nextDelay: 8 | 15 = value === '15' ? 15 : 8;
                  setDraft((prev) => ({
                    ...prev,
                    legalNotice: {
                      ...prev.legalNotice,
                      delayDays: nextDelay,
                    },
                  }));
                }}
                className="grid grid-cols-1 gap-2"
              >
                <Label className="flex items-center gap-2 rounded-2xl border border-border/70 p-4 text-sm">
                  <RadioGroupItem value="8" />
                  {t('reminders.settings.legalNoticeSection.delay8')}
                </Label>
                <Label className="flex items-center gap-2 rounded-2xl border border-border/70 p-4 text-sm">
                  <RadioGroupItem value="15" />
                  {t('reminders.settings.legalNoticeSection.delay15')}
                </Label>
              </RadioGroup>
            </div>

            <Label className="flex items-center gap-2 rounded-2xl border border-border/70 bg-muted/15 p-4 text-sm">
              <Checkbox
                checked={draft.legalNotice.includeInterestClause}
                onCheckedChange={(checked) => {
                  setDraft((prev) => ({
                    ...prev,
                    legalNotice: {
                      ...prev.legalNotice,
                      includeInterestClause: checked === true,
                    },
                  }));
                }}
              />
              {t('reminders.settings.legalNoticeSection.includeInterestClause')}
            </Label>

            <div className="space-y-2">
              <Label htmlFor="legal-custom-footer">{t('reminders.settings.legalNoticeSection.customFooter')}</Label>
              <Textarea
                id="legal-custom-footer"
                rows={6}
                value={draft.legalNotice.customFooter ?? ''}
                onChange={(event) => {
                  const next = event.target.value;
                  setDraft((prev) => ({
                    ...prev,
                    legalNotice: {
                      ...prev.legalNotice,
                      customFooter: next.trim() ? next : null,
                    },
                  }));
                }}
                placeholder={t('reminders.settings.legalNoticeSection.customFooterPlaceholder')}
              />
            </div>

            <Button type="button" className="w-full sm:w-auto" disabled={legalNoticeSaving} onClick={() => void handleSaveLegalNotice()}>
              {legalNoticeSaving ? <Loader2Icon className="size-4 animate-spin" /> : null}
              {legalNoticeSaving ? t('reminders.settings.common.saving') : t('reminders.settings.legalNoticeSection.saveButton')}
            </Button>
          </div>
        </SettingsSectionCard>
      ) : null}
    </div>
  );
}
