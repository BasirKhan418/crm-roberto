'use client';

import { useState } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useLocale } from '@/components/providers/locale-provider';
import { Button } from '@/components/ui/button';
import ErrorMessage from '@/components/ui/ErrorMessage';

interface DeleteCatalogueDialogProps {
  open: boolean;
  item: { _id: string; name: string } | null;
  onClose: () => void;
  onDeleted: () => Promise<void> | void;
}

export default function DeleteCatalogueDialog({ open, item, onClose, onDeleted }: DeleteCatalogueDialogProps) {
  const { locale } = useLocale();
  const t = {
    en: {
      title: 'Delete item',
      descriptionPrefix: 'Are you sure you want to delete',
      descriptionSuffix:
        '? Existing quotes that include this item will not be affected - they store their own copy of the pricing.',
      cancel: 'Cancel',
      confirm: 'Delete',
      deleting: 'Deleting...',
      error: 'Failed to delete item',
    },
    fr: {
      title: 'Supprimer l\'\u00e9l\u00e9ment',
      descriptionPrefix: 'Voulez-vous vraiment supprimer',
      descriptionSuffix:
        '? Les devis existants qui incluent cet \u00e9l\u00e9ment ne seront pas affect\u00e9s - ils stockent leur propre copie du prix.',
      cancel: 'Annuler',
      confirm: 'Supprimer',
      deleting: 'Suppression...',
      error: 'Impossible de supprimer l\'\u00e9l\u00e9ment',
    },
  }[locale];

  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!item?._id) {
      return;
    }

    setError(null);
    setIsDeleting(true);

    try {
      const response = await fetch(`/api/catalogue/${item._id}`, { method: 'DELETE' });
      const data = (await response.json()) as { success?: boolean; message?: string };

      if (!response.ok || !data.success) {
        throw new Error(data.message || t.error);
      }

      await onDeleted();
      onClose();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : t.error);
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t.title}</AlertDialogTitle>
          <AlertDialogDescription>
            {t.descriptionPrefix} <strong>{item?.name ?? '-'}</strong>
            {t.descriptionSuffix}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {error ? <ErrorMessage message={error} /> : null}

        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button type="button" variant="outline" disabled={isDeleting}>
              {t.cancel}
            </Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button type="button" variant="destructive" disabled={isDeleting} onClick={handleDelete}>
              {isDeleting ? t.deleting : t.confirm}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
