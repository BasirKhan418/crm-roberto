'use client';

import type { MouseEvent, ReactNode } from 'react';
import { useEffect } from 'react';

import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';

interface BaseAddModalProps {
  title: string;
  description: string;
  onClose: () => void;
  onSuccess?: () => void;
  children?: ReactNode;
}

export default function BaseAddModal({
  title,
  description,
  onClose,
  onSuccess,
  children,
}: BaseAddModalProps) {
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-[2px]"
      onMouseDown={handleOverlayClick}
      role="presentation"
    >
      <div className="w-full max-w-md rounded-2xl border border-border/80 bg-background p-5 shadow-xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h3 className="font-heading text-lg font-semibold">{title}</h3>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          <Button type="button" size="icon-sm" variant="ghost" aria-label="Close modal" onClick={onClose}>
            <X />
          </Button>
        </div>

        <div className="space-y-3">{children}</div>

        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => {
              onSuccess?.();
              onClose();
            }}
          >
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
