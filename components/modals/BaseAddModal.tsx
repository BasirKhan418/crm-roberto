'use client';

import type { MouseEvent, ReactNode } from 'react';
import { useEffect } from 'react';

import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useLocale } from '@/components/providers/locale-provider';

interface BaseAddModalProps {
  title: string;
  description: string;
  onClose: () => void;
  children?: ReactNode;
}

export default function BaseAddModal({
  title,
  description,
  onClose,
  children,
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
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overscroll-contain bg-black/35 px-4 py-[calc(1rem+var(--app-safe-area-top))] pb-[calc(1rem+var(--app-safe-area-bottom))] backdrop-blur-[2px]"
      onMouseDown={handleOverlayClick}
      role="presentation"
    >
      <div className="w-full max-w-md rounded-2xl border border-border/80 bg-background p-5 shadow-xl">
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
