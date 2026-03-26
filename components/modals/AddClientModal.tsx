'use client';

import BaseAddModal from '@/components/modals/BaseAddModal';

interface AddClientModalProps {
  onClose: () => void;
  onSuccess?: () => void;
}

export default function AddClientModal({ onClose, onSuccess }: AddClientModalProps) {
  return (
    <BaseAddModal
      title="Add client"
      description="Temporary frontend modal. Backend create flow can be connected later."
      onClose={onClose}
      onSuccess={onSuccess}
    >
      <p className="text-sm text-muted-foreground">Use this to validate modal wiring and refresh callbacks.</p>
    </BaseAddModal>
  );
}
