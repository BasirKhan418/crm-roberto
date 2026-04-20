'use client';

import { useEffect, useMemo, useState } from 'react';

import useSWR from 'swr';
import { ChevronDownIcon, Loader2Icon } from 'lucide-react';
import { toast } from 'sonner';

import { useLocale } from '@/components/providers/locale-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useAuthMe } from '@/hooks/useAuthMe';
import { resolveTranslatedError, translate } from '@/lib/i18n/messages';
import { cn } from '@/lib/utils';

type ReminderLevel = 'soft' | 'medium' | 'firm' | 'formalNotice';
type ReminderLocale = 'en' | 'fr';
type LateFeeType = 'fixed' | 'percentage';
type LateFeeApplyFrom = 'medium' | 'firm' | 'formalNotice';

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

type SectionKey = 'timing' | 'templates' | 'lateFees' | 'legalNotice';

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

const DEFAULT_OPEN_SECTIONS: Record<SectionKey, boolean> = {
  timing: true,
  templates: true,
  lateFees: false,
  legalNotice: false,
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

function hasValidOffsets(offsets: ReminderSettingsData['offsets']) {
  return offsets.soft < offsets.medium && offsets.medium < offsets.firm && offsets.firm <= offsets.formalNotice;
}

function CollapsibleSectionCard({
  title,
  description,
  open,
  onToggle,
  children,
}: {
  title: string;
  description: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <button
          type="button"
          onClick={onToggle}
          className="flex w-full items-start justify-between gap-3 text-left"
          aria-expanded={open}
        >
          <div className="space-y-1">
            <CardTitle className="text-lg">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <ChevronDownIcon className={cn('mt-1 size-5 shrink-0 text-muted-foreground transition-transform', open ? 'rotate-180' : '')} />
        </button>
      </CardHeader>
      {open ? <CardContent className="space-y-4">{children}</CardContent> : null}
    </Card>
  );
}

export default function ReminderSettingsPage() {
  const { locale } = useLocale();
  const { user, loading: authLoading } = useAuthMe();

  const [draft, setDraft] = useState<ReminderSettingsData>(DEFAULT_SETTINGS);
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>(DEFAULT_OPEN_SECTIONS);

  const [timingSaving, setTimingSaving] = useState(false);
  const [templateSaving, setTemplateSaving] = useState<Record<ReminderLevel, boolean>>(DEFAULT_LEVEL_LOADING_STATE);
  const [templateResetting, setTemplateResetting] = useState<Record<ReminderLevel, boolean>>(DEFAULT_LEVEL_LOADING_STATE);
  const [templateTabs, setTemplateTabs] = useState<Record<ReminderLevel, ReminderLocale>>(DEFAULT_TEMPLATE_TAB);
  const [lateFeeSaving, setLateFeeSaving] = useState(false);
  const [legalNoticeSaving, setLegalNoticeSaving] = useState(false);

  const t = (key: string, replacements?: Record<string, string | number | null | undefined>) =>
    translate(locale, key, replacements);

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
      setDraft(settings);
    }
  }, [settings]);

  const timingInvalid = useMemo(() => !hasValidOffsets(draft.offsets), [draft.offsets]);

  function toggleSection(section: SectionKey) {
    setOpenSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  }

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
      await patchSettings({ offsets: draft.offsets });
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

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="font-heading text-xl font-semibold tracking-tight">{t('reminders.settings.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('reminders.settings.description')}</p>
      </div>

      <CollapsibleSectionCard
        title={t('reminders.settings.offsets')}
        description={t('reminders.settings.timing.description')}
        open={openSections.timing}
        onToggle={() => toggleSection('timing')}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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

        <Button type="button" disabled={timingSaving} onClick={() => void handleSaveTiming()}>
          {timingSaving ? <Loader2Icon className="size-4 animate-spin" /> : null}
          {timingSaving ? t('reminders.settings.common.saving') : t('reminders.settings.timing.saveButton')}
        </Button>
      </CollapsibleSectionCard>

      <CollapsibleSectionCard
        title={t('reminders.settings.templatesTitle')}
        description={t('reminders.settings.templatesSectionDescription')}
        open={openSections.templates}
        onToggle={() => toggleSection('templates')}
      >
        <div className="space-y-4">
          {LEVELS.map((level) => {
              const activeLocale = templateTabs[level];
              const activeTemplate = draft.templates[activeLocale][level];

              return (
                <Card key={level} className="border-dashed">
                  <CardHeader>
                    <CardTitle className="text-base">{t(`reminders.levels.${level}`)}</CardTitle>
                    <CardDescription>{t('reminders.settings.templates.cardDescription')}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Tabs
                      value={activeLocale}
                      onValueChange={(value) => {
                        const nextLocale: ReminderLocale = value === 'fr' ? 'fr' : 'en';
                        setTemplateTabs((prev) => ({ ...prev, [level]: nextLocale }));
                      }}
                    >
                      <TabsList>
                        <TabsTrigger value="en">{t('reminders.settings.templates.tab.en')}</TabsTrigger>
                        <TabsTrigger value="fr">{t('reminders.settings.templates.tab.fr')}</TabsTrigger>
                      </TabsList>

                      {(['en', 'fr'] as ReminderLocale[]).map((templateLocale) => (
                        <TabsContent key={`${level}-${templateLocale}`} value={templateLocale} className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor={`${level}-${templateLocale}-subject`}>{t('reminders.settings.templates.subject')}</Label>
                            <Input
                              id={`${level}-${templateLocale}-subject`}
                              value={draft.templates[templateLocale][level].subject}
                              onChange={(event) => {
                                const nextValue = event.target.value;
                                setDraft((prev) => ({
                                  ...prev,
                                  templates: {
                                    ...prev.templates,
                                    [templateLocale]: {
                                      ...prev.templates[templateLocale],
                                      [level]: {
                                        ...prev.templates[templateLocale][level],
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
                            <Label htmlFor={`${level}-${templateLocale}-body`}>{t('reminders.settings.templates.body')}</Label>
                            <Textarea
                              id={`${level}-${templateLocale}-body`}
                              rows={8}
                              value={draft.templates[templateLocale][level].body}
                              onChange={(event) => {
                                const nextValue = event.target.value;
                                setDraft((prev) => ({
                                  ...prev,
                                  templates: {
                                    ...prev.templates,
                                    [templateLocale]: {
                                      ...prev.templates[templateLocale],
                                      [level]: {
                                        ...prev.templates[templateLocale][level],
                                        body: nextValue,
                                      },
                                    },
                                  },
                                }));
                              }}
                              placeholder={t('reminders.settings.templates.bodyPlaceholder')}
                            />
                          </div>
                        </TabsContent>
                      ))}
                    </Tabs>

                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                      <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {t('reminders.settings.templates.preview')}
                        </p>
                        <div className="space-y-2 text-sm">
                          <p>
                            <span className="font-medium">{t('reminders.settings.templates.subject')}:</span>{' '}
                            {replaceTemplateVariables(activeTemplate.subject)}
                          </p>
                          <p className="font-medium">{t('reminders.settings.templates.body')}:</p>
                          <p className="whitespace-pre-wrap rounded-md border bg-background p-2 text-sm">
                            {replaceTemplateVariables(activeTemplate.body)}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2 rounded-lg border p-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {t('reminders.settings.templates.sampleVariables')}
                        </p>
                        <div className="grid grid-cols-1 gap-1 text-xs text-muted-foreground">
                          {Object.entries(TEMPLATE_SAMPLE_VARIABLES).map(([name, value]) => (
                            <p key={`${level}-${name}`}>
                              {`{{${name}}}`} = {value}
                            </p>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        onClick={() => void handleSaveTemplate(level)}
                        disabled={templateSaving[level]}
                      >
                        {templateSaving[level] ? <Loader2Icon className="size-4 animate-spin" /> : null}
                        {templateSaving[level] ? t('reminders.settings.common.saving') : t('reminders.settings.templates.saveButton')}
                      </Button>

                      <Button
                        type="button"
                        variant="link"
                        className="px-0"
                        onClick={() => void handleResetTemplates(level)}
                        disabled={templateResetting[level]}
                      >
                        {templateResetting[level] ? t('reminders.settings.common.resetting') : t('reminders.settings.templates.resetButton')}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
          })}
        </div>
      </CollapsibleSectionCard>

      <CollapsibleSectionCard
        title={t('reminders.settings.lateFee')}
        description={t('reminders.settings.lateFees.description')}
        open={openSections.lateFees}
        onToggle={() => toggleSection('lateFees')}
      >
        <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-3">
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
                    className="grid grid-cols-1 gap-2 sm:grid-cols-2"
                  >
                    <Label className="flex items-center gap-2 rounded-lg border p-3 text-sm">
                      <RadioGroupItem value="fixed" />
                      {t('reminders.settings.lateFees.fixedAmount')}
                    </Label>
                    <Label className="flex items-center gap-2 rounded-lg border p-3 text-sm">
                      <RadioGroupItem value="percentage" />
                      {t('reminders.settings.lateFees.percentage')}
                    </Label>
                  </RadioGroup>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                      <SelectTrigger className="h-10 w-full">
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

          <Button type="button" disabled={lateFeeSaving} onClick={() => void handleSaveLateFees()}>
            {lateFeeSaving ? <Loader2Icon className="size-4 animate-spin" /> : null}
            {lateFeeSaving ? t('reminders.settings.common.saving') : t('reminders.settings.lateFees.saveButton')}
          </Button>
        </div>
      </CollapsibleSectionCard>

      <CollapsibleSectionCard
        title={t('reminders.settings.legalNotice')}
        description={t('reminders.settings.legalNoticeSection.description')}
        open={openSections.legalNotice}
        onToggle={() => toggleSection('legalNotice')}
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
                className="grid grid-cols-1 gap-2 sm:grid-cols-2"
              >
                <Label className="flex items-center gap-2 rounded-lg border p-3 text-sm">
                  <RadioGroupItem value="8" />
                  {t('reminders.settings.legalNoticeSection.delay8')}
                </Label>
                <Label className="flex items-center gap-2 rounded-lg border p-3 text-sm">
                  <RadioGroupItem value="15" />
                  {t('reminders.settings.legalNoticeSection.delay15')}
                </Label>
              </RadioGroup>
            </div>

            <Label className="flex items-center gap-2 rounded-lg border p-3 text-sm">
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

          <Button type="button" disabled={legalNoticeSaving} onClick={() => void handleSaveLegalNotice()}>
            {legalNoticeSaving ? <Loader2Icon className="size-4 animate-spin" /> : null}
            {legalNoticeSaving ? t('reminders.settings.common.saving') : t('reminders.settings.legalNoticeSection.saveButton')}
          </Button>
        </div>
      </CollapsibleSectionCard>
    </div>
  );
}