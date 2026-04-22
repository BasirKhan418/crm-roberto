'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

import useSWR from 'swr';
import dayjs from 'dayjs';
import { ChevronDownIcon, ChevronUpIcon, ExternalLinkIcon, InfoIcon, Loader2Icon, RotateCcwIcon, SendIcon } from 'lucide-react';
import { toast } from 'sonner';

import { formatInvoiceDisplayNumber, resolveTranslatedError, translate } from '@/lib/i18n/messages';
import {
  computeLateFeeAmountCents,
  getReminderLevelKey,
  normalizeLateFeeStages,
  type LateFeeConfig,
  type ReminderLevel,
  type ReminderLevelKey,
} from '@/lib/reminders/core';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';

type Locale = 'en' | 'fr';

interface SendReminderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  locale: Locale;
  nextLevel: ReminderLevel;
  clientName?: string | null;
  invoiceNumber?: string | null;
  dueDate?: string | Date | null;
  invoiceDate?: string | Date | null;
  amountDue?: number | null;
  companyName?: string | null;
  onSent?: () => void;
}

interface ReminderTemplate {
  subject: string;
  body: string;
}

type ReminderTemplatesByLevel = Record<ReminderLevelKey, ReminderTemplate>;

interface ReminderSettingsData {
  templates?: {
    en?: ReminderTemplatesByLevel;
    fr?: ReminderTemplatesByLevel;
  };
  lateFee?: LateFeeConfig;
  legalNotice?: {
    delayDays?: 8 | 15 | null;
    includeInterestClause?: boolean | null;
    customFooter?: string | null;
  } | null;
}

interface ReminderSettingsResponse {
  success: boolean;
  data?: ReminderSettingsData;
  message?: string;
}

function formatDate(value: string | Date | null | undefined, locale: Locale): string {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function formatAmount(cents: number | null | undefined, locale: Locale): string {
  const normalized = Number.isFinite(cents) ? Number(cents) : 0;
  return new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', {
    style: 'currency',
    currency: 'EUR',
  }).format(normalized / 100);
}

function computeDaysOverdue(value: string | Date | null | undefined): number {
  if (!value) {
    return 0;
  }
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return 0;
  }
  return Math.max(0, dayjs().startOf('day').diff(dayjs(date).startOf('day'), 'day'));
}

const VARIABLE_TOKEN_REGEX = /(\{\{\s*[a-zA-Z][\w]*\s*\}\}|\{\s*[a-zA-Z][\w]*\s*\})/g;
const VARIABLE_NAME_REGEX = /^\{\{?\s*([a-zA-Z][\w]*)\s*\}?\}$/;

type PreviewToken =
  | { kind: 'text'; value: string }
  | { kind: 'var'; name: string; value: string; isEmpty: boolean };

type ReminderVariableName =
  | 'clientName'
  | 'companyName'
  | 'invoiceNumber'
  | 'invoiceDate'
  | 'dueDate'
  | 'daysOverdue'
  | 'amountDue'
  | 'amountOriginal'
  | 'lateFees'
  | 'paymentLink'
  | 'legalDeadline';

const EDITABLE_TEMPLATE_VARIABLE_REGEX = /\{\{\s*([a-zA-Z][\w]*)\s*\}\}|\{\s*([a-zA-Z][\w]*)\s*\}/g;

const REMINDER_VARIABLE_LABELS: Record<Locale, Record<ReminderVariableName, string>> = {
  en: {
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
  fr: {
    clientName: 'Nom du client',
    companyName: 'Nom de l\'entreprise',
    invoiceNumber: 'Numéro de facture',
    invoiceDate: 'Date de facture',
    dueDate: 'Date d\'échéance',
    daysOverdue: 'Jours de retard',
    amountDue: 'Montant dû',
    amountOriginal: 'Montant initial',
    lateFees: 'Pénalités de retard',
    paymentLink: 'Lien de paiement',
    legalDeadline: 'Date limite légale',
  },
};

function extractTemplateVariablesInOrder(template: string): string[] {
  return Array.from(template.matchAll(EDITABLE_TEMPLATE_VARIABLE_REGEX), (match) => match[1] || match[2]).filter(Boolean);
}

function buildLockedMarker(variable: string, labels: Record<string, string>): string {
  return `[${labels[variable] ?? variable}]`;
}

function toEditableTemplate(template: string, labels: Record<string, string>): string {
  return template.replace(EDITABLE_TEMPLATE_VARIABLE_REGEX, (_full, keyA: string, keyB: string) =>
    buildLockedMarker(keyA || keyB, labels)
  );
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

function tokenizePreview(template: string, variables: Record<string, string>): PreviewToken[] {
  if (!template) {
    return [];
  }

  const parts = template.split(VARIABLE_TOKEN_REGEX);
  const tokens: PreviewToken[] = [];

  for (const part of parts) {
    if (!part) {
      continue;
    }
    const varMatch = part.match(VARIABLE_NAME_REGEX);
    if (varMatch) {
      const name = varMatch[1];
      const resolved = variables[name];
      const hasValue = resolved !== undefined && resolved !== null && String(resolved).trim().length > 0;
      tokens.push({
        kind: 'var',
        name,
        value: hasValue ? String(resolved) : '',
        isEmpty: !hasValue,
      });
    } else {
      tokens.push({ kind: 'text', value: part });
    }
  }

  return tokens;
}

function mapLevelToKey(level: ReminderLevel): ReminderLevelKey {
  return getReminderLevelKey(level);
}

const REMINDER_LEVELS: ReminderLevel[] = [1, 2, 3, 4];

const fetcher = async (url: string): Promise<ReminderSettingsResponse> => {
  const response = await fetch(url, { cache: 'no-store' });
  const payload = (await response.json()) as ReminderSettingsResponse;

  if (!response.ok || !payload.success) {
    throw new Error(payload.message || 'Failed to load templates');
  }

  return payload;
};

function PreviewText({ tokens, labels }: { tokens: PreviewToken[]; labels: Record<string, string> }) {
  return (
    <>
      {tokens.map((token, idx) => {
        if (token.kind === 'text') {
          return <span key={idx}>{token.value}</span>;
        }
        if (token.isEmpty) {
          return (
            <span
              key={idx}
              title={buildLockedMarker(token.name, labels)}
              className="rounded bg-amber-100 px-1 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
            >
              {buildLockedMarker(token.name, labels)}
            </span>
          );
        }
        return (
          <span
            key={idx}
            title={buildLockedMarker(token.name, labels)}
            className="rounded bg-primary/10 px-0.5 font-medium text-foreground"
          >
            {token.value}
          </span>
        );
      })}
    </>
  );
}

export default function SendReminderModal({
  open,
  onOpenChange,
  invoiceId,
  locale,
  nextLevel,
  clientName,
  invoiceNumber,
  dueDate,
  invoiceDate,
  amountDue,
  companyName,
  onSent,
}: SendReminderModalProps) {
  const [level, setLevel] = useState<ReminderLevel>(nextLevel);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [subjectTouched, setSubjectTouched] = useState(false);
  const [bodyTouched, setBodyTouched] = useState(false);

  const t = (key: string, replacements?: Record<string, string | number | null | undefined>) =>
    translate(locale, key, replacements);

  const { data: settings, isLoading: settingsLoading } = useSWR<ReminderSettingsResponse>(
    open ? '/api/reminders/settings' : null,
    fetcher
  );

  const templateByLevel = useMemo(() => {
    const selectedLocaleTemplates = locale === 'fr' ? settings?.data?.templates?.fr : settings?.data?.templates?.en;
    return selectedLocaleTemplates ?? null;
  }, [locale, settings?.data?.templates?.en, settings?.data?.templates?.fr]);

  const normalizedLateFeeStages = useMemo(
    () => normalizeLateFeeStages(settings?.data?.lateFee),
    [settings?.data?.lateFee]
  );

  const baseAmountDueCents = Math.max(0, Math.round(amountDue ?? 0));

  const lateFeeAmountCents = useMemo(
    () => computeLateFeeAmountCents(baseAmountDueCents, level, settings?.data?.lateFee),
    [baseAmountDueCents, level, settings?.data?.lateFee]
  );

  const totalWithLateFeeCents = baseAmountDueCents + lateFeeAmountCents;
  const currentStageConfig = normalizedLateFeeStages[mapLevelToKey(level)];

  const daysOverdue = useMemo(() => computeDaysOverdue(dueDate), [dueDate]);
  const isOverdue = daysOverdue > 0;
  const formalNoticeLocked = !isOverdue;

  const legalDeadlineDate = useMemo(() => {
    if (level !== 4) {
      return null;
    }
    const delayDays = settings?.data?.legalNotice?.delayDays === 15 ? 15 : 8;
    return dayjs().add(delayDays, 'day').toDate();
  }, [level, settings?.data?.legalNotice?.delayDays]);

  const displayInvoiceNumber = useMemo(
    () => (invoiceNumber?.trim() ? formatInvoiceDisplayNumber(locale, invoiceNumber.trim()) : '-'),
    [invoiceNumber, locale]
  );

  const previewVariables = useMemo<Record<string, string>>(() => {
    const lateFeesText = lateFeeAmountCents > 0 ? formatAmount(lateFeeAmountCents, locale) : '';
    return {
      clientName: clientName?.trim() || (locale === 'fr' ? 'Client' : 'Client'),
      invoiceNumber: displayInvoiceNumber,
      amountDue: formatAmount(totalWithLateFeeCents, locale),
      amountOriginal: formatAmount(baseAmountDueCents, locale),
      dueDate: formatDate(dueDate, locale) || '-',
      invoiceDate: formatDate(invoiceDate, locale) || '-',
      daysOverdue: String(daysOverdue),
      lateFees: lateFeesText,
      companyName: companyName?.trim() || '-',
      paymentLink: t('reminders.collection.sendModal.paymentLinkPlaceholder'),
      legalDeadline: legalDeadlineDate
        ? new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          }).format(legalDeadlineDate)
        : '',
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    baseAmountDueCents,
    clientName,
    companyName,
    daysOverdue,
    displayInvoiceNumber,
    dueDate,
    invoiceDate,
    lateFeeAmountCents,
    legalDeadlineDate,
    locale,
    totalWithLateFeeCents,
  ]);

  const previewVariableLabels = useMemo<Record<string, string>>(() => REMINDER_VARIABLE_LABELS[locale], [locale]);

  const editableSubject = useMemo(
    () => toEditableTemplate(subject, previewVariableLabels),
    [previewVariableLabels, subject]
  );

  const editableBody = useMemo(
    () => toEditableTemplate(body, previewVariableLabels),
    [body, previewVariableLabels]
  );

  const applyTemplate = useCallback(
    (targetLevel: ReminderLevel, options?: { force?: boolean }) => {
      const levelKey = mapLevelToKey(targetLevel);
      const template = templateByLevel?.[levelKey];
      if (!template && !options?.force) {
        return;
      }
      setSubject(template?.subject ?? '');
      setBody(template?.body ?? '');
      setSubjectTouched(false);
      setBodyTouched(false);
    },
    [templateByLevel]
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    // Guard: never land on level 4 for a non-overdue invoice — the backend will
    // reject it and the user should not be able to select it in the first place.
    if (nextLevel === 4 && !isOverdue) {
      setLevel(3);
      return;
    }
    setLevel(nextLevel);
  }, [nextLevel, open, isOverdue]);

  // When modal opens or level/template set changes, load the template for the level,
  // but don't overwrite user edits made since the last template load.
  useEffect(() => {
    if (!open) {
      return;
    }
    if (!templateByLevel) {
      return;
    }
    if (subjectTouched || bodyTouched) {
      return;
    }
    const template = templateByLevel[mapLevelToKey(level)];
    setSubject(template?.subject ?? '');
    setBody(template?.body ?? '');
  }, [open, level, templateByLevel, subjectTouched, bodyTouched]);

  // Reset touched markers on close so next open starts fresh.
  useEffect(() => {
    if (!open) {
      setSubjectTouched(false);
      setBodyTouched(false);
      setPreviewOpen(false);
    }
  }, [open]);

  const selectedTemplateExists = Boolean(templateByLevel?.[mapLevelToKey(level)]);
  const levelIsInvalid = level === 4 && formalNoticeLocked;
  const canSubmit = subject.trim().length > 0 && body.trim().length > 0 && !levelIsInvalid;
  const previewToggleLabel =
    locale === 'fr'
      ? previewOpen
        ? 'Masquer l\'aperçu'
        : 'Afficher l\'aperçu'
      : previewOpen
        ? 'Hide preview'
        : 'Show preview';

  async function handleSend() {
    if (sending) {
      return;
    }

    if (levelIsInvalid) {
      toast.error(t('reminders.collection.sendModal.formalNoticeRequiresOverdue'));
      return;
    }

    if (!subject.trim()) {
      toast.error(t('reminders.collection.sendModal.subjectRequired'));
      return;
    }
    if (!body.trim()) {
      toast.error(t('reminders.collection.sendModal.bodyRequired'));
      return;
    }

    setSending(true);

    try {
      const response = await fetch(`/api/invoices/${invoiceId}/reminders/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level,
          subject: subject.trim(),
          body: body.trim(),
          locale,
        }),
      });

      const payload = (await response.json()) as { success?: boolean; message?: string };
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || t('reminders.collection.sendModal.sendFailed'));
      }

      toast.success(t('reminders.collection.sendModal.sendSuccess'));
      onSent?.();
      onOpenChange(false);
    } catch (error) {
      toast.error(resolveTranslatedError(locale, error, t('reminders.collection.sendModal.sendFailed')));
    } finally {
      setSending(false);
    }
  }

  function renderLateFeeBadge(levelValue: ReminderLevel) {
    const stage = normalizedLateFeeStages[mapLevelToKey(levelValue)];
    if (!stage.enabled || stage.value <= 0) {
      return null;
    }
    const label =
      stage.type === 'fixed'
        ? t('reminders.collection.sendModal.lateFeeBadgeFixed', {
            amount: formatAmount(Math.round(stage.value * 100), locale),
          })
        : t('reminders.collection.sendModal.lateFeeBadgePercent', { value: stage.value });
    return (
      <Badge
        variant="secondary"
        className="ml-0 h-auto max-w-full shrink-0 whitespace-normal px-2 py-0.5 text-[10px] font-medium leading-tight sm:ml-auto sm:max-w-40"
      >
        {label}
      </Badge>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-0.75rem)] max-w-3xl gap-0 overflow-hidden rounded-2xl p-0 pr-0 sm:w-[min(100%-2rem,48rem)]">
        <div className="flex max-h-[calc(var(--app-viewport-height)-0.75rem-var(--app-safe-area-top)-var(--app-safe-area-bottom))] flex-col sm:max-h-[calc(var(--app-viewport-height)-2rem-var(--app-safe-area-top)-var(--app-safe-area-bottom))]">
          <DialogHeader className="border-b px-4 pb-4 pt-5 text-center sm:px-6 sm:pb-5 sm:pt-6">
            <div className="mx-auto flex w-full max-w-2xl flex-col gap-1.5 text-center">
              <DialogTitle className="flex items-center justify-center gap-2 pr-8 text-balance sm:pr-0">
                <SendIcon className="size-4" />
                {t('reminders.collection.sendModal.title')}
              </DialogTitle>
              <DialogDescription className="text-balance">{t('reminders.collection.sendModal.description')}</DialogDescription>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-2xl space-y-4 px-4 py-4 sm:px-6 sm:py-5">
              <div className="space-y-2">
            <Label>{t('reminders.collection.sendModal.level')}</Label>
            <RadioGroup
              value={String(level)}
              onValueChange={(value) => {
                const nextLevelValue: ReminderLevel =
                  value === '1' ? 1 : value === '2' ? 2 : value === '3' ? 3 : 4;
                if (nextLevelValue === 4 && formalNoticeLocked) {
                  return;
                }
                setLevel(nextLevelValue);
                setSubjectTouched(false);
                setBodyTouched(false);
              }}
              className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4"
            >
              {REMINDER_LEVELS.map((lvl) => {
                const locked = lvl === 4 && formalNoticeLocked;
                return (
                  <Label
                    key={lvl}
                    className={
                      locked
                        ? 'flex min-w-0 flex-wrap items-center gap-2 rounded-lg border border-dashed p-3 text-sm opacity-60 cursor-not-allowed'
                        : 'flex min-w-0 flex-wrap items-center gap-2 rounded-lg border p-3 text-sm cursor-pointer'
                    }
                    title={locked ? t('reminders.collection.sendModal.formalNoticeRequiresOverdue') : undefined}
                  >
                    <RadioGroupItem value={String(lvl)} className="shrink-0" disabled={locked} />
                    <span className="min-w-0 flex-1">{t(`reminders.levels.${mapLevelToKey(lvl)}`)}</span>
                    {locked ? (
                      <span className="ml-auto text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        {t('reminders.collection.sendModal.formalNoticeLockedShort')}
                      </span>
                    ) : (
                      renderLateFeeBadge(lvl)
                    )}
                  </Label>
                );
              })}
            </RadioGroup>
            {formalNoticeLocked ? (
              <p className="text-[11px] text-muted-foreground">
                {t('reminders.collection.sendModal.formalNoticeRequiresOverdue')}
              </p>
            ) : null}
          </div>

          {!currentStageConfig.enabled || currentStageConfig.value <= 0 ? (
            <div className="flex items-start gap-2 rounded-lg border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
              <InfoIcon className="mt-0.5 size-4 shrink-0" />
              <div className="flex-1 space-y-1">
                <p>{t('reminders.collection.sendModal.lateFeeNotConfigured')}</p>
                <Link
                  href="/settings/reminders"
                  className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t('reminders.collection.sendModal.configureLateFees')}
                  <ExternalLinkIcon className="size-3" />
                </Link>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">
              <p>
                {t('reminders.collection.sendModal.lateFeeSummary', {
                  amount: formatAmount(lateFeeAmountCents, locale),
                })}
              </p>
              <p className="mt-1">
                {t('reminders.collection.sendModal.amountWithFees', {
                  amount: formatAmount(totalWithLateFeeCents, locale),
                })}
              </p>
            </div>
          )}

          {!selectedTemplateExists && !settingsLoading ? (
            <div className="rounded-lg border border-dashed bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-100">
              <p className="font-medium">{t('reminders.collection.sendModal.templateMissingTitle')}</p>
              <p className="mt-1">{t('reminders.collection.sendModal.templateMissingBody')}</p>
            </div>
          ) : null}

          <div className="space-y-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Label htmlFor="send-reminder-subject">{t('reminders.settings.templates.subject')}</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-full gap-1 text-xs sm:h-7 sm:w-auto"
                onClick={() => applyTemplate(level, { force: true })}
                disabled={settingsLoading}
              >
                <RotateCcwIcon className="size-3" />
                {t('reminders.collection.sendModal.reloadTemplate')}
              </Button>
            </div>
            <Input
              id="send-reminder-subject"
              value={editableSubject}
              className="text-sm"
              onChange={(event) => {
                setSubject(rebuildTemplateFromEditable(event.target.value, subject, previewVariableLabels));
                setSubjectTouched(true);
              }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="send-reminder-body">{t('reminders.settings.templates.body')}</Label>
            <Textarea
              id="send-reminder-body"
              rows={8}
              value={editableBody}
              className="min-h-45 text-sm sm:min-h-55"
              onChange={(event) => {
                setBody(rebuildTemplateFromEditable(event.target.value, body, previewVariableLabels));
                setBodyTouched(true);
              }}
            />
          </div>

          <div className="overflow-hidden rounded-lg border bg-muted/20 text-sm">
            <Button
              type="button"
              variant="ghost"
              className="h-auto w-full justify-between rounded-none px-3 py-3 text-left hover:bg-muted/50"
              aria-expanded={previewOpen}
              aria-label={previewToggleLabel}
              onClick={() => setPreviewOpen((current) => !current)}
            >
              <span className="min-w-0 text-left">
                <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t('reminders.collection.sendModal.preview')}
                </span>
                <span className="mt-1 block text-[11px] whitespace-normal text-muted-foreground sm:text-xs">
                  {t('reminders.collection.sendModal.previewHint')}
                </span>
              </span>
              <span className="ml-3 inline-flex shrink-0 items-center gap-1 text-xs font-medium text-foreground">
                {previewToggleLabel}
                {previewOpen ? <ChevronUpIcon className="size-4" /> : <ChevronDownIcon className="size-4" />}
              </span>
            </Button>

            {previewOpen ? (
              <div className="border-t px-3 pb-3 pt-3">
                <div className="mb-3 flex flex-wrap gap-1.5 border-b pb-2">
                  {Object.entries(previewVariables).map(([name, value]) => {
                    const isEmpty = !value || !String(value).trim();
                    return (
                      <span
                        key={name}
                        className={
                          isEmpty
                            ? 'inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-900 dark:bg-amber-900/40 dark:text-amber-100'
                            : 'inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-foreground'
                        }
                        title={buildLockedMarker(name, previewVariableLabels)}
                      >
                        <span className="font-mono text-[10px] opacity-70">{previewVariableLabels[name] ?? name}</span>
                        <span className="font-medium">
                          {isEmpty ? t('reminders.collection.sendModal.emptyValue') : String(value)}
                        </span>
                      </span>
                    );
                  })}
                </div>

                {settingsLoading ? (
                  <p className="text-xs text-muted-foreground">{t('reminders.collection.sendModal.loadingTemplates')}</p>
                ) : (
                  <>
                    <p className="font-medium wrap-break-word">
                      <PreviewText tokens={tokenizePreview(subject, previewVariables)} labels={previewVariableLabels} />
                    </p>
                    <p className="mt-2 whitespace-pre-wrap wrap-break-word text-muted-foreground">
                      <PreviewText tokens={tokenizePreview(body, previewVariables)} labels={previewVariableLabels} />
                    </p>
                  </>
                )}
                {level === 4 && legalDeadlineDate ? (
                  <p className="mt-3 border-t pt-2 text-[11px] italic text-muted-foreground">
                    {t('reminders.collection.sendModal.legalDeadlinePreview', {
                      date: previewVariables.legalDeadline,
                    })}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
            </div>
          </div>

          <DialogFooter className="border-t bg-background/95 px-4 py-4 backdrop-blur sm:px-6">
            <div className="mx-auto flex w-full max-w-2xl flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={sending} className="w-full sm:w-auto">
                {t('reminders.collection.sendModal.cancel')}
              </Button>
              <Button type="button" onClick={() => void handleSend()} disabled={sending || !canSubmit} className="w-full sm:w-auto">
                {sending ? <Loader2Icon className="size-4 animate-spin" /> : null}
                {sending ? t('reminders.collection.sendModal.sending') : t('reminders.collection.sendModal.send')}
              </Button>
            </div>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

