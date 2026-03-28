'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

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
  const router = useRouter();
  const { locale } = useLocale();
  const t = {
    en: { client: 'Client', supplier: 'Supplier', note: 'Note', quote: 'Quote' },
    fr: { client: 'Client', supplier: 'Fournisseur', note: 'Note', quote: 'Devis' },
  }[locale];

  return (
    <>
      <div className="w-full rounded-xl border border-border/80 bg-background/95 p-2 shadow-xs backdrop-blur-sm sm:w-auto">
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="justify-start font-medium sm:justify-center"
            onClick={() => setOpen('client')}
          >
          <Plus />
          {t.client}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="justify-start font-medium sm:justify-center"
            onClick={() => setOpen('supplier')}
          >
            <Plus />
            {t.supplier}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="justify-start border-sky-300 bg-sky-50 text-sky-900 hover:bg-sky-100 sm:justify-center dark:border-sky-800/80 dark:bg-sky-950/30 dark:text-sky-200"
            onClick={() => setOpen('note')}
          >
            <Plus />
            {t.note}
          </Button>
          <Button
            type="button"
            size="sm"
            className="justify-start bg-slate-900 text-white hover:bg-slate-800 sm:justify-center dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
            onClick={() => router.push('/quotes/new')}
          >
            <Plus />
            {t.quote}
          </Button>
        </div>
      </div>

      {open === 'client' ? <AddClientModal onClose={() => setOpen(null)} onSuccess={onSuccess} /> : null}
      {open === 'supplier' ? <AddSupplierModal onClose={() => setOpen(null)} onSuccess={onSuccess} /> : null}
      {open === 'note' ? <AddNoteModal onClose={() => setOpen(null)} onSuccess={onSuccess} /> : null}
    </>
  );
}