'use client';

import { ExternalLinkIcon } from 'lucide-react';

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
      <DialogContent className="p-4 pr-4 sm:max-w-4xl sm:p-5 sm:pr-5">
        <DialogHeader>
          <DialogTitle>{attachment?.name || t.title}</DialogTitle>
          <DialogDescription>{t.description}</DialogDescription>
        </DialogHeader>

        {attachment ? (
          <div className="space-y-3">
            <div className="overflow-hidden rounded-lg border bg-muted/20 p-2">
              {isImageMime(attachment.mimeType) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={attachment.url}
                  alt={attachment.name}
                  className="max-h-[50vh] w-full rounded-md object-contain sm:max-h-[70vh]"
                />
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

            <div className="flex justify-end">
              <Button asChild variant="outline">
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
