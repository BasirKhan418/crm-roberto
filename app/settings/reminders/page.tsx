'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';

import useSWR from 'swr';
import { useSearchParams } from 'next/navigation';
import { AlertTriangleIcon, BellIcon, FileTextIcon, Loader2Icon, MailIcon } from 'lucide-react';
import { toast } from 'sonner';

import { useLocale } from '@/components/providers/locale-provider';
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
    enabled: boolean;
    type: LateFeeType;
    value: number;
    applyFrom: LateFeeApplyFrom;
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
  data?: Partial<ReminderSettingsData>;
}

const LEVELS: ReminderLevel[] = ['soft', 'medium', 'firm', 'formalNotice'];

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
    enabled: false,
    type: 'percentage',
    value: 0,
    applyFrom: 'formalNotice',
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
    lateFeesSummary: 'Turn on optional overdue charges and define when they apply.',
    legalNoticeEyebrow: 'Legal notice',
    legalNoticeSummary: 'Set the formal notice delay and any legal footer text.',
    templateLevelLabel: 'Which reminder email do you want to edit?',
    templateLevelHelp: 'Pick the email step first, then choose the language.',
    templateLocaleLabel: 'Language',
    templateIntroTitle: 'Write the email in your own words',
    templateIntroText: 'If you want, you can insert customer or invoice details automatically using smart fields.',
    smartFieldsButton: 'Show smart fields',
    smartFieldsTitle: 'Smart fields',
    smartFieldsDescription: 'These fields fill in automatically when the reminder is sent.',
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
    lateFeesSummary: 'Activez les pénalités de retard et définissez à partir de quand elles s\'appliquent.',
    legalNoticeEyebrow: 'Mise en demeure',
    legalNoticeSummary: 'Réglez le délai de mise en demeure et le texte juridique complémentaire.',
    templateLevelLabel: 'Quel e-mail de relance souhaitez-vous modifier ?',
    templateLevelHelp: 'Choisissez d\'abord l\'étape, puis la langue.',
    templateLocaleLabel: 'Langue',
    templateIntroTitle: 'Rédigez l\'e-mail avec vos propres mots',
    templateIntroText: 'Si besoin, vous pouvez insérer automatiquement les détails du client ou de la facture avec des champs intelligents.',
    smartFieldsButton: 'Voir les champs intelligents',
    smartFieldsTitle: 'Champs intelligents',
    smartFieldsDescription: 'Ces champs se remplissent automatiquement lors de l\'envoi de la relance.',
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
  return template.replace(/\{\{(\w+)\}\}/g, (_full, variable: string) => {
    return TEMPLATE_SAMPLE_VARIABLES[variable] ?? '';
  });
}

function normalizeSettings(input?: Partial<ReminderSettingsData>): ReminderSettingsData {
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
      enabled: input?.lateFee?.enabled ?? DEFAULT_SETTINGS.lateFee.enabled,
      type: input?.lateFee?.type ?? DEFAULT_SETTINGS.lateFee.type,
      value: input?.lateFee?.value ?? DEFAULT_SETTINGS.lateFee.value,
      applyFrom: input?.lateFee?.applyFrom ?? DEFAULT_SETTINGS.lateFee.applyFrom,
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

export default function ReminderSettingsPage() {
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
    const sectionParam = searchParams.get('section');
    if (isSectionKey(sectionParam)) {
      setActiveSection(sectionParam);
    }
  }, [searchParams]);

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

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="space-y-1">
        <h2 className="font-heading text-xl font-semibold tracking-tight">{t('reminders.settings.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('reminders.settings.description')}</p>
      </div>

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
          <div className="space-y-4 rounded-2xl border border-border/70 bg-muted/15 p-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">{pageChrome.templateIntroTitle}</p>
              <p className="text-sm text-muted-foreground">{pageChrome.templateIntroText}</p>
            </div>
            <Dialog>
              <DialogTrigger asChild>
                <Button type="button" variant="outline" className="w-full sm:w-auto">
                  {pageChrome.smartFieldsButton}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{pageChrome.smartFieldsTitle}</DialogTitle>
                  <DialogDescription>{pageChrome.smartFieldsDescription}</DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-1 gap-2">
                  {Object.entries(TEMPLATE_SAMPLE_VARIABLES).map(([name, value]) => (
                    <div key={name} className="rounded-xl border border-border/70 p-3">
                      <p className="text-sm font-medium">{pageChrome.smartFieldLabels[name as keyof typeof pageChrome.smartFieldLabels]}</p>
                      <p className="text-xs text-muted-foreground">{`{{${name}}}`}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{value}</p>
                    </div>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
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

          <div className="space-y-2">
            <Label htmlFor="template-subject">{t('reminders.settings.templates.subject')}</Label>
            <Input
              id="template-subject"
              value={draft.templates[activeTemplateLocale][activeTemplateLevel].subject}
              onChange={(event) => {
                const nextValue = event.target.value;
                setDraft((prev) => ({
                  ...prev,
                  templates: {
                    ...prev.templates,
                    [activeTemplateLocale]: {
                      ...prev.templates[activeTemplateLocale],
                      [activeTemplateLevel]: {
                        ...prev.templates[activeTemplateLocale][activeTemplateLevel],
                        subject: nextValue,
                      },
                    },
                  },
                }));
              }}
              placeholder={t('reminders.settings.templates.subjectPlaceholder')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="template-body">{t('reminders.settings.templates.body')}</Label>
            <Textarea
              id="template-body"
              rows={12}
              value={draft.templates[activeTemplateLocale][activeTemplateLevel].body}
              onChange={(event) => {
                const nextValue = event.target.value;
                setDraft((prev) => ({
                  ...prev,
                  templates: {
                    ...prev.templates,
                    [activeTemplateLocale]: {
                      ...prev.templates[activeTemplateLocale],
                      [activeTemplateLevel]: {
                        ...prev.templates[activeTemplateLocale][activeTemplateLevel],
                        body: nextValue,
                      },
                    },
                  },
                }));
              }}
              placeholder={t('reminders.settings.templates.bodyPlaceholder')}
            />
          </div>

          <div className="rounded-2xl border border-border/70 bg-muted/15 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t('reminders.settings.templates.preview')}
            </p>
            <div className="mt-3 space-y-2 text-sm">
              <p>
                <span className="font-medium">{t('reminders.settings.templates.subject')}:</span>{' '}
                {replaceTemplateVariables(activeTemplate.subject)}
              </p>
              <p className="font-medium">{t('reminders.settings.templates.body')}:</p>
              <p className="whitespace-pre-wrap rounded-xl border border-border/70 bg-background p-3 text-sm">
                {replaceTemplateVariables(activeTemplate.body)}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Button
              type="button"
              className="w-full sm:w-auto"
              onClick={() => void handleSaveTemplate(activeTemplateLevel)}
              disabled={templateSaving[activeTemplateLevel]}
            >
              {templateSaving[activeTemplateLevel] ? <Loader2Icon className="size-4 animate-spin" /> : null}
              {templateSaving[activeTemplateLevel] ? t('reminders.settings.common.saving') : t('reminders.settings.templates.saveButton')}
            </Button>

            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => void handleResetTemplates(activeTemplateLevel)}
              disabled={templateResetting[activeTemplateLevel]}
            >
              {templateResetting[activeTemplateLevel] ? t('reminders.settings.common.resetting') : t('reminders.settings.templates.resetButton')}
            </Button>
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
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-muted/15 p-4">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">{t('reminders.settings.lateFees.enable')}</p>
                <p className="text-xs text-muted-foreground">{t('reminders.settings.lateFees.enableHelp')}</p>
              </div>
              <Switch
                checked={draft.lateFee.enabled}
                onCheckedChange={(checked) => {
                  setDraft((prev) => ({
                    ...prev,
                    lateFee: {
                      ...prev.lateFee,
                      enabled: checked,
                    },
                  }));
                }}
              />
            </div>

            {draft.lateFee.enabled ? (
              <>
                <div className="space-y-2">
                  <Label>{t('reminders.settings.lateFees.type')}</Label>
                  <RadioGroup
                    value={draft.lateFee.type}
                    onValueChange={(value) => {
                      const nextType: LateFeeType = value === 'fixed' ? 'fixed' : 'percentage';
                      setDraft((prev) => ({
                        ...prev,
                        lateFee: {
                          ...prev.lateFee,
                          type: nextType,
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

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="late-fee-value">{t('reminders.settings.lateFees.value')}</Label>
                    <Input
                      id="late-fee-value"
                      type="number"
                      min={0}
                      step="0.01"
                      value={draft.lateFee.value}
                      onChange={(event) => {
                        const next = Number(event.target.value);
                        if (!Number.isFinite(next)) {
                          return;
                        }

                        setDraft((prev) => ({
                          ...prev,
                          lateFee: {
                            ...prev.lateFee,
                            value: next,
                          },
                        }));
                      }}
                    />
                    <p className="text-xs text-muted-foreground">
                      {draft.lateFee.type === 'fixed' ? t('reminders.settings.lateFees.valueHelpFixed') : t('reminders.settings.lateFees.valueHelpPercent')}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>{t('reminders.settings.lateFees.applyFrom')}</Label>
                    <Select
                      value={draft.lateFee.applyFrom}
                      onValueChange={(value) => {
                        const applyFrom: LateFeeApplyFrom =
                          value === 'medium' || value === 'firm' || value === 'formalNotice' ? value : 'formalNotice';

                        setDraft((prev) => ({
                          ...prev,
                          lateFee: {
                            ...prev.lateFee,
                            applyFrom,
                          },
                        }));
                      }}
                    >
                      <SelectTrigger className="h-11 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="medium">{t('reminders.levels.medium')}</SelectItem>
                        <SelectItem value="firm">{t('reminders.levels.firm')}</SelectItem>
                        <SelectItem value="formalNotice">{t('reminders.levels.formalNotice')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            ) : null}

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
