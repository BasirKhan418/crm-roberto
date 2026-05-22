'use client';

import { ExternalLinkIcon } from 'lucide-react';

import { InteractiveReceiptImage } from '@/components/expenses/interactive-receipt-image';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type AttachmentPreview = {
  name: string;
  url: string;
  mimeType?: string;
};

type AttachmentPreviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  attachment: AttachmentPreview | null;
  locale: 'en' | 'fr';
};

function isImageMime(mime?: string) {
  return typeof mime === 'string' && mime.startsWith('image/');
}

function isPdfMime(mime?: string) {
  return mime === 'application/pdf';
}

export function AttachmentPreviewDialog({ open, onOpenChange, attachment, locale }: AttachmentPreviewDialogProps) {
  const t = {
    en: {
      title: 'Attachment preview',
      description: 'Preview attachment content before download.',
      openInTab: 'Open in new tab',
      unsupported: 'Preview is not available for this file type.',
    },
    fr: {
      title: 'Apercu piece jointe',
      description: 'Visualisez la piece jointe avant telechargement.',
      openInTab: 'Ouvrir dans un nouvel onglet',
      unsupported: 'Apercu non disponible pour ce type de fichier.',
    },
  }[locale];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1rem)] gap-3 p-4 pr-4 sm:max-w-4xl sm:gap-4 sm:p-5 sm:pr-5">
        <DialogHeader className="pr-8">
          <DialogTitle>{attachment?.name || t.title}</DialogTitle>
          <DialogDescription>{t.description}</DialogDescription>
        </DialogHeader>

        {attachment ? (
          <div className="space-y-3">
            <div className="overflow-hidden rounded-lg border bg-muted/20 p-2">
              {isImageMime(attachment.mimeType) ? (
                <div className="h-[50vh] sm:h-[70vh]">
                  <InteractiveReceiptImage
                    src={attachment.url}
                    alt={attachment.name}
                    locale={locale}
                    maxScale={8}
                    className="h-full w-full rounded-md border-border/60"
                  />
                </div>
              ) : null}

              {isPdfMime(attachment.mimeType) ? (
                <iframe
                  src={attachment.url}
                  title={attachment.name}
                  className="h-[50vh] w-full rounded-md sm:h-[70vh]"
                />
              ) : null}

              {!isImageMime(attachment.mimeType) && !isPdfMime(attachment.mimeType) ? (
                <p className="px-2 py-10 text-center text-sm text-muted-foreground">{t.unsupported}</p>
              ) : null}
            </div>

            <div className="flex justify-stretch sm:justify-end">
              <Button asChild variant="outline" className="h-auto w-full whitespace-normal px-3 py-2 text-center sm:w-auto sm:whitespace-nowrap">
                <a href={attachment.url} target="_blank" rel="noreferrer noopener">
                  <ExternalLinkIcon className="size-4" />
                  {t.openInTab}
                </a>
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
