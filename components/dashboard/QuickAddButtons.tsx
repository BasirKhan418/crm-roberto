'use client';

import { useState } from 'react';
import { UserPlus, Building2, PenLine, FileText, ReceiptText } from 'lucide-react';

import AddClientModal from '@/components/modals/AddClientModal';
import AddNoteModal from '@/components/modals/AddNoteModal';
import AddSupplierModal from '@/components/modals/AddSupplierModal';
import NewInvoiceModal from '@/components/modals/NewInvoiceModal';
import NewQuoteModal from '@/components/modals/NewQuoteModal';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/components/providers/locale-provider';

type OpenModal = 'client' | 'supplier' | 'note' | 'quote' | 'invoice' | null;

interface QuickAddButtonsProps {
  onSuccess?: () => void;
}

export default function QuickAddButtons({ onSuccess }: QuickAddButtonsProps) {
  const [open, setOpen] = useState<OpenModal>(null);
  const { locale } = useLocale();
  const t = {
    en: { client: 'Add Client', supplier: 'Add Supplier', note: 'Add Note', quote: 'New Quote', invoice: 'New Invoice' },
    fr: { client: 'Ajouter Client', supplier: 'Ajouter Fournisseur', note: 'Ajouter Note', quote: 'Nouveau Devis', invoice: 'Nouvelle Facture' },
  }[locale];

  return (
    <>
      <div className="flex w-full flex-wrap justify-center gap-2 lg:w-auto lg:justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-tour-create-client
          className="h-10 min-w-35 flex-1 basis-35 justify-center gap-1.5 rounded-2xl border-indigo-300 bg-white px-4 text-sm text-indigo-700 shadow-sm hover:border-indigo-400 hover:bg-indigo-50 sm:flex-none dark:border-indigo-700 dark:bg-transparent dark:text-indigo-300 dark:hover:bg-indigo-950/40"
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
          className="h-10 min-w-35 flex-1 basis-35 justify-center gap-1.5 rounded-2xl border-amber-300 bg-white px-4 text-sm text-amber-700 shadow-sm hover:border-amber-400 hover:bg-amber-50 sm:flex-none dark:border-amber-700 dark:bg-transparent dark:text-amber-300 dark:hover:bg-amber-950/40"
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
          className="h-10 min-w-35 flex-1 basis-35 justify-center gap-1.5 rounded-2xl border-teal-300 bg-white px-4 text-sm text-teal-700 shadow-sm hover:border-teal-400 hover:bg-teal-50 sm:flex-none dark:border-teal-700 dark:bg-transparent dark:text-teal-300 dark:hover:bg-teal-950/40"
          onClick={() => setOpen('note')}
        >
          <PenLine className="size-3.5" strokeWidth={2} />
          {t.note}
        </Button>
        <Button
          type="button"
          size="sm"
          data-tour-create-quote
          className="h-10 min-w-35 flex-1 basis-35 justify-center gap-1.5 rounded-2xl bg-slate-800 px-4 text-sm text-white shadow-sm hover:bg-slate-900 sm:flex-none dark:bg-slate-700 dark:hover:bg-slate-600"
          onClick={() => setOpen('quote')}
        >
          <FileText className="size-3.5" strokeWidth={2} />
          {t.quote}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-tour-new-invoice
          className="h-10 min-w-35 flex-1 basis-35 justify-center gap-1.5 rounded-2xl border-emerald-300 bg-white px-4 text-sm text-emerald-700 shadow-sm hover:border-emerald-400 hover:bg-emerald-50 sm:flex-none dark:border-emerald-700 dark:bg-transparent dark:text-emerald-300 dark:hover:bg-emerald-950/40"
          onClick={() => setOpen('invoice')}
        >
          <ReceiptText className="size-3.5" strokeWidth={2} />
          {t.invoice}
        </Button>
      </div>

      {open === 'client' ? <AddClientModal onClose={() => setOpen(null)} onSuccess={onSuccess} /> : null}
      {open === 'supplier' ? <AddSupplierModal onClose={() => setOpen(null)} onSuccess={onSuccess} /> : null}
      {open === 'note' ? <AddNoteModal onClose={() => setOpen(null)} onSuccess={onSuccess} /> : null}
      {open === 'quote' ? <NewQuoteModal onClose={() => setOpen(null)} /> : null}
      {open === 'invoice' ? <NewInvoiceModal onClose={() => setOpen(null)} /> : null}
    </>
  );
}