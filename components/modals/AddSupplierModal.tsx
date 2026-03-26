'use client';

import BaseAddModal from '@/components/modals/BaseAddModal';

interface AddSupplierModalProps {
  onClose: () => void;
  onSuccess?: () => void;
}

export default function AddSupplierModal({ onClose, onSuccess }: AddSupplierModalProps) {
  return (
    <BaseAddModal
      title="Add supplier"
      description="Temporary frontend modal. Backend create flow can be connected later."
      onClose={onClose}
      onSuccess={onSuccess}
    >
      <p className="text-sm text-muted-foreground">Use this to validate modal wiring and refresh callbacks.</p>
    </BaseAddModal>
  );
}
