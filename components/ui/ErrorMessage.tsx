"use client";

import { AlertTriangle } from 'lucide-react';

import { useLocale } from '@/components/providers/locale-provider';
import { resolveTranslatedText, translate } from '@/lib/i18n/messages';

interface ErrorMessageProps {
  message?: string;
}

export default function ErrorMessage({ message }: ErrorMessageProps) {
  const { locale } = useLocale();
  const resolvedMessage = resolveTranslatedText(
    locale,
    message,
    translate(locale, 'common.genericErrorRefresh')
  );

  return (
    <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <p>{resolvedMessage}</p>
    </div>
  );
}
