'use client';

import { useEffect, useState } from 'react';

import { SaveIcon } from 'lucide-react';
import { toast } from 'sonner';

import CrmShell from '@/components/crm-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import ErrorMessage from '@/components/ui/ErrorMessage';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';

interface ProfileForm {
  companyName: string;
  ownerName: string;
  phone: string;
  businessEmail: string;
  address: string;
  vatNumber: string;
}

const emptyForm: ProfileForm = {
  companyName: '',
  ownerName: '',
  phone: '',
  businessEmail: '',
  address: '',
  vatNumber: '',
};

export default function ProfilePage() {
  const [form, setForm] = useState<ProfileForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exists, setExists] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    async function loadProfile() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/cprofile', { cache: 'no-store' });
        const data = (await response.json()) as {
          success: boolean;
          message?: string;
          profile?: Partial<ProfileForm>;
        };

        if (!response.ok || !data.success) {
          setExists(false);
          setForm(emptyForm);
          setLoading(false);
          return;
        }

        setExists(true);
        setForm({
          companyName: data.profile?.companyName || '',
          ownerName: data.profile?.ownerName || '',
          phone: data.profile?.phone || '',
          businessEmail: data.profile?.businessEmail || '',
          address: data.profile?.address || '',
          vatNumber: data.profile?.vatNumber || '',
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, []);

  async function saveProfile() {
    setSaving(true);

    try {
      const response = await fetch('/api/cprofile', {
        method: exists ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = (await response.json()) as { success: boolean; message?: string };
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to save profile');
      }

      setExists(true);
      toast.success('Company profile saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  }

  async function updatePassword() {
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      toast.error('All password fields are required');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('New password and confirm password must match');
      return;
    }

    setPasswordSaving(true);

    try {
      const response = await fetch('/api/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(passwordForm),
      });

      const data = (await response.json()) as { success: boolean; message?: string };
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to update password');
      }

      toast.success('Password updated successfully');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update password');
    } finally {
      setPasswordSaving(false);
    }
  }

  return (
    <CrmShell title="Company Profile">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Company Profile</h1>
        <p className="text-sm text-muted-foreground">Configure your business identity and contact details.</p>
      </div>

      <Card id="company-profile" className="scroll-mt-20">
        <CardHeader className="border-b">
          <CardTitle>{exists ? 'Update company profile' : 'Create company profile'}</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {error ? <ErrorMessage message={error} /> : null}

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, idx) => (
                <Skeleton key={idx} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Company name</Label>
                <Input value={form.companyName} onChange={(e) => setForm((p) => ({ ...p, companyName: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Owner name</Label>
                <Input value={form.ownerName} onChange={(e) => setForm((p) => ({ ...p, ownerName: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Business email</Label>
                <Input type="email" value={form.businessEmail} onChange={(e) => setForm((p) => ({ ...p, businessEmail: e.target.value }))} />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label>Address</Label>
                <Input value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>VAT number</Label>
                <Input value={form.vatNumber} onChange={(e) => setForm((p) => ({ ...p, vatNumber: e.target.value }))} />
              </div>
            </div>
          )}

          <div className="mt-4">
            <Button onClick={saveProfile} disabled={saving || loading}>
              <SaveIcon />
              {saving ? 'Saving...' : 'Save profile'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card id="password-security" className="scroll-mt-20">
        <CardHeader className="border-b">
          <CardTitle>Update password</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1.5 md:col-span-2">
              <Label>Current password</Label>
              <Input
                type="password"
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm((p) => ({ ...p, currentPassword: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>New password</Label>
              <Input
                type="password"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm((p) => ({ ...p, newPassword: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Confirm password</Label>
              <Input
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm((p) => ({ ...p, confirmPassword: e.target.value }))}
              />
            </div>
          </div>

          <div className="mt-4">
            <Button onClick={updatePassword} disabled={passwordSaving}>
              <SaveIcon />
              {passwordSaving ? 'Updating...' : 'Update password'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </CrmShell>
  );
}
