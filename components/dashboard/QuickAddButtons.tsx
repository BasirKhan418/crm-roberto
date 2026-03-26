'use client';

import { useState } from 'react';

import { Plus } from 'lucide-react';

import AddClientModal from '@/components/modals/AddClientModal';
import AddNoteModal from '@/components/modals/AddNoteModal';
import AddSupplierModal from '@/components/modals/AddSupplierModal';
import { Button } from '@/components/ui/button';

type OpenModal = 'client' | 'supplier' | 'note' | null;

interface QuickAddButtonsProps {
  onSuccess?: () => void;
}

export default function QuickAddButtons({ onSuccess }: QuickAddButtonsProps) {
  const [open, setOpen] = useState<OpenModal>(null);

  return (
    <>
      <div className="sticky top-3 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-border/80 bg-background/95 p-2 shadow-xs backdrop-blur-sm">
        <Button type="button" variant="outline" size="sm" className="font-medium" onClick={() => setOpen('client')}>
          <Plus />
          Client
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="font-medium"
          onClick={() => setOpen('supplier')}
        >
          <Plus />
          Supplier
        </Button>
        <Button type="button" size="sm" className="font-medium" onClick={() => setOpen('note')}>
          <Plus />
          Note
        </Button>
      </div>

      {open === 'client' ? <AddClientModal onClose={() => setOpen(null)} onSuccess={onSuccess} /> : null}
      {open === 'supplier' ? <AddSupplierModal onClose={() => setOpen(null)} onSuccess={onSuccess} /> : null}
      {open === 'note' ? <AddNoteModal onClose={() => setOpen(null)} onSuccess={onSuccess} /> : null}
    </>
  );
}