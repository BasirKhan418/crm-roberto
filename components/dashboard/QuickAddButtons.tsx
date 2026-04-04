'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus, Building2, PenLine, FileText } from 'lucide-react';

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
    en: { client: 'Add Client', supplier: 'Add Supplier', note: 'Add Note', quote: 'New Quote' },
    fr: { client: 'Ajouter Client', supplier: 'Ajouter Fournisseur', note: 'Ajouter Note', quote: 'Nouveau Devis' },
  }[locale];

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-tour-create-client
          className="h-9 gap-1.5 border-indigo-300 bg-white text-indigo-700 shadow-sm hover:border-indigo-400 hover:bg-indigo-50 dark:border-indigo-700 dark:bg-transparent dark:text-indigo-300 dark:hover:bg-indigo-950/40"
          onClick={() => setOpen('client')}
        >
          <UserPlus className="size-3.5" strokeWidth={2} />
          {t.client}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-tour-create-supplier
          className="h-9 gap-1.5 border-amber-300 bg-white text-amber-700 shadow-sm hover:border-amber-400 hover:bg-amber-50 dark:border-amber-700 dark:bg-transparent dark:text-amber-300 dark:hover:bg-amber-950/40"
          onClick={() => setOpen('supplier')}
        >
          <Building2 className="size-3.5" strokeWidth={2} />
          {t.supplier}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-tour-create-note
          className="h-9 gap-1.5 border-teal-300 bg-white text-teal-700 shadow-sm hover:border-teal-400 hover:bg-teal-50 dark:border-teal-700 dark:bg-transparent dark:text-teal-300 dark:hover:bg-teal-950/40"
          onClick={() => setOpen('note')}
        >
          <PenLine className="size-3.5" strokeWidth={2} />
          {t.note}
        </Button>
        <Button
          type="button"
          size="sm"
          data-tour-create-quote
          className="h-9 gap-1.5 bg-slate-800 text-white shadow-sm hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600"
          onClick={() => router.push('/quotes/new')}
        >
          <FileText className="size-3.5" strokeWidth={2} />
          {t.quote}
        </Button>
      </div>

      {open === 'client' ? <AddClientModal onClose={() => setOpen(null)} onSuccess={onSuccess} /> : null}
      {open === 'supplier' ? <AddSupplierModal onClose={() => setOpen(null)} onSuccess={onSuccess} /> : null}
      {open === 'note' ? <AddNoteModal onClose={() => setOpen(null)} onSuccess={onSuccess} /> : null}
    </>
  );
}