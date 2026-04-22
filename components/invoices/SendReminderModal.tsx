'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import useSWR from 'swr';
import { Loader2Icon, SendIcon } from 'lucide-react';
import { toast } from 'sonner';

import { resolveTranslatedError, translate } from '@/lib/i18n/messages';
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
type ReminderLevel = 1 | 2 | 3 | 4;
type ReminderLevelKey = 'soft' | 'medium' | 'firm' | 'formalNotice';

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

interface ReminderSettingsResponse {
  success: boolean;
  data?: {
    templates?: {
      en?: ReminderTemplatesByLevel;
      fr?: ReminderTemplatesByLevel;
    };
  };
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

function replaceTemplateVariables(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-zA-Z][\w]*)\s*\}\}|\{\s*([a-zA-Z][\w]*)\s*\}/g, (_full, variableA: string, variableB: string) => {
    const variable = variableA || variableB;
    return variables[variable] ?? '';
  });
}

function mapLevelToKey(level: ReminderLevel): ReminderLevelKey {
  if (level === 1) {
    return 'soft';
  }
  if (level === 2) {
    return 'medium';
  }
  if (level === 3) {
    return 'firm';
  }
  return 'formalNotice';
}

const fetcher = async (url: string): Promise<ReminderSettingsResponse> => {
  const response = await fetch(url, { cache: 'no-store' });
  const payload = (await response.json()) as ReminderSettingsResponse;

  if (!response.ok || !payload.success) {
    throw new Error(payload.message || 'Failed to load templates');
  }

  return payload;
};

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

  const t = (key: string, replacements?: Record<string, string | number | null | undefined>) =>
    translate(locale, key, replacements);

  const { data: settings } = useSWR<ReminderSettingsResponse>(open ? '/api/reminders/settings' : null, fetcher);

  const templateByLevel = useMemo(() => {
    const selectedLocaleTemplates = locale === 'fr' ? settings?.data?.templates?.fr : settings?.data?.templates?.en;
    return selectedLocaleTemplates ?? null;
  }, [locale, settings?.data?.templates?.en, settings?.data?.templates?.fr]);

  const previewVariables = useMemo<Record<string, string>>(
    () => ({
      clientName: clientName?.trim() || '-',
      invoiceNumber: invoiceNumber?.trim() || '-',
      amountDue: formatAmount(amountDue, locale),
      dueDate: formatDate(dueDate, locale) || '-',
      invoiceDate: formatDate(invoiceDate, locale) || '-',
      companyName: companyName?.trim() || '-',
    }),
    [amountDue, clientName, companyName, dueDate, invoiceDate, invoiceNumber, locale]
  );

  const applyTemplate = useCallback(
    (nextLevel: ReminderLevel) => {
      const levelKey = mapLevelToKey(nextLevel);
      const template = templateByLevel?.[levelKey];
      setSubject(template?.subject ?? '');
      setBody(template?.body ?? '');
    },
    [templateByLevel]
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    setLevel(nextLevel);
  }, [nextLevel, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    applyTemplate(level);
  }, [applyTemplate, level, open]);

  async function handleSend() {
    if (sending) {
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
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
              }}
              className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4"
            >
              <Label className="flex items-center gap-2 rounded-lg border p-3 text-sm">
                <RadioGroupItem value="1" />
                {t('reminders.levels.soft')}
              </Label>
              <Label className="flex items-center gap-2 rounded-lg border p-3 text-sm">
                <RadioGroupItem value="2" />
                {t('reminders.levels.medium')}
              </Label>
              <Label className="flex items-center gap-2 rounded-lg border p-3 text-sm">
                <RadioGroupItem value="3" />
                {t('reminders.levels.firm')}
              </Label>
              <Label className="flex items-center gap-2 rounded-lg border p-3 text-sm">
                <RadioGroupItem value="4" />
                {t('reminders.levels.formalNotice')}
              </Label>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="send-reminder-subject">{t('reminders.settings.templates.subject')}</Label>
            <Input
              id="send-reminder-subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="send-reminder-body">{t('reminders.settings.templates.body')}</Label>
            <Textarea
              id="send-reminder-body"
              rows={10}
              value={body}
              onChange={(event) => setBody(event.target.value)}
            />
          </div>

          <div className="rounded-lg border bg-muted/20 p-3 text-sm">
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t('reminders.settings.templates.preview')}
            </p>
            <p className="font-medium">{replaceTemplateVariables(subject, previewVariables)}</p>
            <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{replaceTemplateVariables(body, previewVariables)}</p>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            {t('reminders.collection.sendModal.cancel')}
          </Button>
          <Button type="button" onClick={() => void handleSend()} disabled={sending}>
            {sending ? <Loader2Icon className="size-4 animate-spin" /> : null}
            {sending ? t('reminders.collection.sendModal.sending') : t('reminders.collection.sendModal.send')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
