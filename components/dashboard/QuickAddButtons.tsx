'use client';

import { useState } from 'react';

import { Plus } from 'lucide-react';

import AddClientModal from '@/components/modals/AddClientModal';
import AddNoteModal from '@/components/modals/AddNoteModal';
import AddSupplierModal from '@/components/modals/AddSupplierModal';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/components/providers/locale-provider';

type OpenModal = 'client' | 'supplier' | 'note' | null;

interface QuickAddButtonsProps {
  onSuccess?: () => void;
}

export default function QuickAddButtons({ onSuccess }: QuickAddButtonsProps) {
  const [open, setOpen] = useState<OpenModal>(null);
  const { locale } = useLocale();
  const t = {
    en: { client: 'Client', supplier: 'Supplier', note: 'Note' },
    fr: { client: 'Client', supplier: 'Fournisseur', note: 'Note' },
  }[locale];

  return (
    <>
      <div className="sticky top-3 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-border/80 bg-background/95 p-2 shadow-xs backdrop-blur-sm">
        <Button type="button" variant="outline" size="sm" className="font-medium" onClick={() => setOpen('client')}>
          <Plus />
          {t.client}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="font-medium"
          onClick={() => setOpen('supplier')}
        >
          <Plus />
          {t.supplier}
        </Button>
        <Button type="button" size="sm" className="font-medium" onClick={() => setOpen('note')}>
          <Plus />
          {t.note}
        </Button>
      </div>

      {open === 'client' ? <AddClientModal onClose={() => setOpen(null)} onSuccess={onSuccess} /> : null}
      {open === 'supplier' ? <AddSupplierModal onClose={() => setOpen(null)} onSuccess={onSuccess} /> : null}
      {open === 'note' ? <AddNoteModal onClose={() => setOpen(null)} onSuccess={onSuccess} /> : null}
    </>
  );
}