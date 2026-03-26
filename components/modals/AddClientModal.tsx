'use client';

import { useState } from 'react';

import { toast } from 'sonner';

import BaseAddModal from '@/components/modals/BaseAddModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface AddClientModalProps {
  onClose: () => void;
  onSuccess?: () => void;
}

export default function AddClientModal({ onClose, onSuccess }: AddClientModalProps) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    address: '',
    companyName: '',
    vatNumber: '',
  });

  async function handleSave() {
    if (!form.fullName.trim()) {
      toast.error('Client name is required');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: form.fullName,
          email: form.email || undefined,
          phone: form.phone || undefined,
          address: form.address || undefined,
          companyName: form.companyName || undefined,
          vatNumber: form.vatNumber || undefined,
        }),
      });

      const data = (await response.json()) as { success: boolean; message?: string };
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to create client');
      }

      toast.success('Client created');
      onSuccess?.();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create client');
    } finally {
      setLoading(false);
    }
  }

  return (
    <BaseAddModal
      title="Add client"
      description="Create a client from dashboard quick actions."
      onClose={onClose}
    >
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>Name</Label>
          <Input value={form.fullName} onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label>Phone</Label>
          <Input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label>Address</Label>
          <Input value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Company</Label>
            <Input value={form.companyName} onChange={(e) => setForm((p) => ({ ...p, companyName: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>VAT/Tax ID</Label>
            <Input value={form.vatNumber} onChange={(e) => setForm((p) => ({ ...p, vatNumber: e.target.value }))} />
          </div>
        </div>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} disabled={loading}>{loading ? 'Saving...' : 'Save client'}</Button>
      </div>
    </BaseAddModal>
  );
}
