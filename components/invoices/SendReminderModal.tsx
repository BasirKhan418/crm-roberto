'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

import useSWR from 'swr';
import dayjs from 'dayjs';
import { ExternalLinkIcon, InfoIcon, Loader2Icon, RotateCcwIcon, SendIcon } from 'lucide-react';
import { toast } from 'sonner';

import { resolveTranslatedError, translate } from '@/lib/i18n/messages';
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

function PreviewText({ tokens }: { tokens: PreviewToken[] }) {
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
              title={`{{${token.name}}}`}
              className="rounded bg-amber-100 px-1 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
            >
              {`{{${token.name}}}`}
            </span>
          );
        }
        return (
          <span
            key={idx}
            title={`{{${token.name}}}`}
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

  const legalDeadlineDate = useMemo(() => {
    if (level !== 4) {
      return null;
    }
    const delayDays = settings?.data?.legalNotice?.delayDays === 15 ? 15 : 8;
    return dayjs().add(delayDays, 'day').toDate();
  }, [level, settings?.data?.legalNotice?.delayDays]);

  const previewVariables = useMemo<Record<string, string>>(() => {
    const lateFeesText = lateFeeAmountCents > 0 ? formatAmount(lateFeeAmountCents, locale) : '';
    return {
      clientName: clientName?.trim() || (locale === 'fr' ? 'Client' : 'Client'),
      invoiceNumber: invoiceNumber?.trim() || '-',
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
    dueDate,
    invoiceDate,
    invoiceNumber,
    lateFeeAmountCents,
    legalDeadlineDate,
    locale,
    totalWithLateFeeCents,
  ]);

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

    setLevel(nextLevel);
  }, [nextLevel, open]);

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
    }
  }, [open]);

  const selectedTemplateExists = Boolean(templateByLevel?.[mapLevelToKey(level)]);
  const canSubmit = subject.trim().length > 0 && body.trim().length > 0;

  async function handleSend() {
    if (sending) {
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
        className="ml-auto shrink-0 whitespace-nowrap px-1.5 py-0 text-[10px] font-medium leading-4"
      >
        {label}
      </Badge>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SendIcon className="size-4" />
            {t('reminders.collection.sendModal.title')}
          </DialogTitle>
          <DialogDescription>{t('reminders.collection.sendModal.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t('reminders.collection.sendModal.level')}</Label>
            <RadioGroup
              value={String(level)}
              onValueChange={(value) => {
                const nextLevelValue: ReminderLevel =
                  value === '1' ? 1 : value === '2' ? 2 : value === '3' ? 3 : 4;
                setLevel(nextLevelValue);
                setSubjectTouched(false);
                setBodyTouched(false);
              }}
              className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4"
            >
              {REMINDER_LEVELS.map((lvl) => (
                <Label
                  key={lvl}
                  className="flex min-w-0 items-center gap-2 rounded-lg border p-3 text-sm cursor-pointer"
                >
                  <RadioGroupItem value={String(lvl)} className="shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{t(`reminders.levels.${mapLevelToKey(lvl)}`)}</span>
                  {renderLateFeeBadge(lvl)}
                </Label>
              ))}
            </RadioGroup>
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
            <div className="flex items-center justify-between">
              <Label htmlFor="send-reminder-subject">{t('reminders.settings.templates.subject')}</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-xs"
                onClick={() => applyTemplate(level, { force: true })}
                disabled={settingsLoading}
              >
                <RotateCcwIcon className="size-3" />
                {t('reminders.collection.sendModal.reloadTemplate')}
              </Button>
            </div>
            <Input
              id="send-reminder-subject"
              value={subject}
              onChange={(event) => {
                setSubject(event.target.value);
                setSubjectTouched(true);
              }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="send-reminder-body">{t('reminders.settings.templates.body')}</Label>
            <Textarea
              id="send-reminder-body"
              rows={10}
              value={body}
              onChange={(event) => {
                setBody(event.target.value);
                setBodyTouched(true);
              }}
            />
          </div>

          <div className="rounded-lg border bg-muted/20 p-3 text-sm">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t('reminders.collection.sendModal.preview')}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {t('reminders.collection.sendModal.previewHint')}
              </p>
            </div>

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
                    title={`{{${name}}}`}
                  >
                    <span className="font-mono text-[10px] opacity-70">{name}</span>
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
                <p className="font-medium">
                  <PreviewText tokens={tokenizePreview(subject, previewVariables)} />
                </p>
                <p className="mt-2 whitespace-pre-wrap text-muted-foreground">
                  <PreviewText tokens={tokenizePreview(body, previewVariables)} />
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
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            {t('reminders.collection.sendModal.cancel')}
          </Button>
          <Button type="button" onClick={() => void handleSend()} disabled={sending || !canSubmit}>
            {sending ? <Loader2Icon className="size-4 animate-spin" /> : null}
            {sending ? t('reminders.collection.sendModal.sending') : t('reminders.collection.sendModal.send')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

