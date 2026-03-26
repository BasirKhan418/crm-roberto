'use client';

import { useEffect, useMemo, useState } from 'react';

import { toast } from 'sonner';

import BaseAddModal from '@/components/modals/BaseAddModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface LinkedEntity {
  _id: string;
  fullName: string;
}

interface AddNoteModalProps {
  onClose: () => void;
  onSuccess?: () => void;
}

export default function AddNoteModal({ onClose, onSuccess }: AddNoteModalProps) {
  const [loading, setLoading] = useState(false);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [clients, setClients] = useState<LinkedEntity[]>([]);
  const [suppliers, setSuppliers] = useState<LinkedEntity[]>([]);
  const [form, setForm] = useState({
    title: '',
    description: '',
    linkedType: 'client' as 'client' | 'supplier',
    linkedId: '',
    followUpDate: '',
  });

  const linkedOptions = useMemo(
    () => (form.linkedType === 'client' ? clients : suppliers),
    [clients, suppliers, form.linkedType]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadOptions() {
      setOptionsLoading(true);
      try {
        const [clientsRes, suppliersRes] = await Promise.all([
          fetch('/api/clients?page=1&limit=100&sortBy=fullName&sortOrder=asc', { cache: 'no-store' }),
          fetch('/api/suppliers?page=1&limit=100&sortBy=fullName&sortOrder=asc', { cache: 'no-store' }),
        ]);

        const [clientsData, suppliersData] = await Promise.all([clientsRes.json(), suppliersRes.json()]);
        if (cancelled) {
          return;
        }

        setClients((clientsData?.data ?? []) as LinkedEntity[]);
        setSuppliers((suppliersData?.data ?? []) as LinkedEntity[]);
      } catch {
        if (!cancelled) {
          setClients([]);
          setSuppliers([]);
        }
      } finally {
        if (!cancelled) {
          setOptionsLoading(false);
        }
      }
    }

    loadOptions();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSave() {
    if (!form.title.trim()) {
      toast.error('Note title is required');
      return;
    }
    if (!form.description.trim()) {
      toast.error('Description is required');
      return;
    }
    if (!form.linkedId) {
      toast.error(`Please select a ${form.linkedType}`);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          linkedType: form.linkedType,
          linkedId: form.linkedId,
          followUpDate: form.followUpDate || undefined,
        }),
      });

      const data = (await response.json()) as { success: boolean; message?: string };
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to create note');
      }

      toast.success('Note created');
      onSuccess?.();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create note');
    } finally {
      setLoading(false);
    }
  }

  return (
    <BaseAddModal
      title="Add note"
      description="Create a note and optionally schedule a follow-up date."
      onClose={onClose}
    >
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>Title</Label>
          <Input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label>Description</Label>
          <textarea
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            rows={4}
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Linked type</Label>
            <Select
              value={form.linkedType}
              onValueChange={(value: 'client' | 'supplier') =>
                setForm((p) => ({ ...p, linkedType: value, linkedId: '' }))
              }
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="client">Client</SelectItem>
                <SelectItem value="supplier">Supplier</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Linked record</Label>
            <Select value={form.linkedId} onValueChange={(value) => setForm((p) => ({ ...p, linkedId: value }))}>
              <SelectTrigger>
                <SelectValue placeholder={optionsLoading ? 'Loading...' : `Select ${form.linkedType}`} />
              </SelectTrigger>
              <SelectContent>
                {linkedOptions.length > 0 ? (
                  linkedOptions.map((item) => (
                    <SelectItem key={item._id} value={item._id}>
                      {item.fullName}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="none" disabled>
                    No {form.linkedType}s available
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Follow-up date (optional)</Label>
          <Input
            type="date"
            value={form.followUpDate}
            onChange={(e) => setForm((p) => ({ ...p, followUpDate: e.target.value }))}
          />
        </div>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} disabled={loading}>{loading ? 'Saving...' : 'Save note'}</Button>
      </div>
    </BaseAddModal>
  );
}
