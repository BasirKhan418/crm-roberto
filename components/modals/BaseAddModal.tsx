'use client';

import type { MouseEvent, ReactNode } from 'react';
import { useEffect } from 'react';

import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useLocale } from '@/components/providers/locale-provider';
import { cn } from '@/lib/utils';
import { translate } from '@/lib/i18n/messages';

interface BaseAddModalProps {
  title: string;
  description: string;
  onClose: () => void;
  children?: ReactNode;
  panelClassName?: string;
}

export default function BaseAddModal({
  title,
  description,
  onClose,
  children,
  panelClassName,
}: BaseAddModalProps) {
  const { locale } = useLocale();
  const closeLabel = translate(locale, 'common.closeModal');

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  function handleOverlayClick(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overscroll-contain bg-black/35 px-3 pt-[calc(0.75rem+var(--app-safe-area-top))] pb-[calc(1rem+var(--app-safe-area-bottom))] backdrop-blur-[2px] sm:items-center sm:px-4 sm:pt-[calc(1.25rem+var(--app-safe-area-top))] sm:pb-[calc(1.25rem+var(--app-safe-area-bottom))]"
      onMouseDown={handleOverlayClick}
      role="presentation"
    >
      <div className={cn(
        'mx-auto mt-1 flex w-full max-w-md flex-col self-start max-h-[calc(100dvh-2rem-var(--app-safe-area-top)-var(--app-safe-area-bottom))] overflow-y-auto rounded-2xl border border-border/80 bg-background p-4 shadow-xl sm:mt-0 sm:self-center sm:max-h-[calc(100dvh-2.5rem-var(--app-safe-area-top)-var(--app-safe-area-bottom))] sm:p-5',
        panelClassName
      )}>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            className="mb-2 ml-auto flex shrink-0 self-end"
            aria-label={closeLabel}
            onClick={onClose}
          >
            <X />
          </Button>

          <div className="mb-3 w-full min-w-0 text-center sm:text-left">
            <h3 className="font-heading text-lg font-semibold wrap-break-word">{title}</h3>
            <p className="text-sm text-muted-foreground wrap-break-word">{description}</p>
          </div>

          <div className="w-full space-y-3">{children}</div>
        </div>
    </div>
  );
}
