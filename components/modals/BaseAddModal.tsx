'use client';

import type { MouseEvent, ReactNode } from 'react';
import { useEffect } from 'react';

import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useLocale } from '@/components/providers/locale-provider';
import { cn } from '@/lib/utils';

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
  const closeLabel = locale === 'fr' ? 'Fermer la fenetre' : 'Close modal';

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
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto overscroll-contain bg-black/35 px-3 py-[calc(0.75rem+var(--app-safe-area-top))] pb-[calc(0.75rem+var(--app-safe-area-bottom))] backdrop-blur-[2px] sm:items-center sm:px-4 sm:py-[calc(1rem+var(--app-safe-area-top))] sm:pb-[calc(1rem+var(--app-safe-area-bottom))]"
      onMouseDown={handleOverlayClick}
      role="presentation"
    >
      <div className={cn(
        'w-full max-w-md max-h-[calc(100dvh-1.5rem-var(--app-safe-area-top)-var(--app-safe-area-bottom))] overflow-y-auto rounded-2xl border border-border/80 bg-background p-4 shadow-xl sm:max-h-[calc(100dvh-2rem-var(--app-safe-area-top)-var(--app-safe-area-bottom))] sm:p-5',
        panelClassName
      )}>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            className="mb-3 self-end flex ml-auto"
            aria-label={closeLabel}
            onClick={onClose}
          >
            <X />
          </Button>

          <div className="mb-3 min-w-0">
            <h3 className="font-heading text-lg font-semibold wrap-break-word">{title}</h3>
            <p className="text-sm text-muted-foreground wrap-break-word">{description}</p>
          </div>

          <div className="space-y-3">{children}</div>
        </div>
    </div>
  );
}
