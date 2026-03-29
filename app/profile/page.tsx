'use client';

import { useEffect, useRef, useState } from 'react';

import { BuildingIcon, SaveIcon, Trash2Icon, UploadIcon } from 'lucide-react';
import Image from 'next/image';
import { toast } from 'sonner';

import CrmShell from '@/components/crm-shell';
import { useLocale } from '@/components/providers/locale-provider';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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

const ALLOWED_LOGO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
const MAX_LOGO_SIZE = 5 * 1024 * 1024; 

const emptyForm: ProfileForm = {
  companyName: '',
  ownerName: '',
  phone: '',
  businessEmail: '',
  address: '',
  vatNumber: '',
};

export default function ProfilePage() {
  const { locale } = useLocale();
  const t = {
    en: {
      loadFailed: 'Failed to load profile',
      saveFailed: 'Failed to save profile',
      saved: 'Company profile saved',
      passwordRequired: 'All password fields are required',
      passwordMismatch: 'New password and confirm password must match',
      passwordUpdateFailed: 'Failed to update password',
      passwordUpdated: 'Password updated successfully',
      shellTitle: 'Company Profile',
      heading: 'Company Profile',
      subtitle: 'Configure your business identity and contact details.',
      updateTitle: 'Update company profile',
      createTitle: 'Create company profile',
      companyName: 'Company name',
      ownerName: 'Owner name',
      phone: 'Phone',
      businessEmail: 'Business email',
      address: 'Address',
      vat: 'VAT number',
      saving: 'Saving...',
      saveProfile: 'Save profile',
      updatePassword: 'Update password',
      currentPassword: 'Current password',
      newPassword: 'New password',
      confirmPassword: 'Confirm password',
      updating: 'Updating...',
      updatePasswordBtn: 'Update password',
      logoTitle: 'Company Logo',
      logoSubtitle: 'Used on quotes and invoices. Max 2 MB — JPEG, PNG, WebP or SVG.',
      uploadLogo: 'Upload logo',
      replaceLogo: 'Replace logo',
      deleteLogo: 'Delete logo',
      deleteLogoTitle: 'Delete company logo?',
      deleteLogoDesc: 'The logo will be permanently removed from your profile and future documents.',
      cancel: 'Cancel',
      confirm: 'Delete',
      uploading: 'Uploading...',
      deleting: 'Deleting...',
      logoUploaded: 'Logo uploaded',
      logoDeleted: 'Logo deleted',
      logoUploadFailed: 'Failed to upload logo',
      logoDeleteFailed: 'Failed to delete logo',
      logoTypeError: 'Invalid file type. Accepted: JPEG, PNG, WebP, SVG',
      logoSizeError: 'File too large. Maximum size is 2 MB',
    },
    fr: {
      loadFailed: 'Impossible de charger le profil',
      saveFailed: 'Impossible d\'enregistrer le profil',
      saved: 'Profil entreprise enregistre',
      passwordRequired: 'Tous les champs de mot de passe sont requis',
      passwordMismatch: 'Le nouveau mot de passe et la confirmation doivent correspondre',
      passwordUpdateFailed: 'Impossible de mettre a jour le mot de passe',
      passwordUpdated: 'Mot de passe mis a jour avec succes',
      shellTitle: 'Profil entreprise',
      heading: 'Profil entreprise',
      subtitle: 'Configurez l\'identite de votre entreprise et les coordonnees.',
      updateTitle: 'Mettre a jour le profil entreprise',
      createTitle: 'Creer le profil entreprise',
      companyName: 'Nom de l\'entreprise',
      ownerName: 'Nom du proprietaire',
      phone: 'Telephone',
      businessEmail: 'E-mail professionnel',
      address: 'Adresse',
      vat: 'Numero de TVA',
      saving: 'Enregistrement...',
      saveProfile: 'Enregistrer le profil',
      updatePassword: 'Mettre a jour le mot de passe',
      currentPassword: 'Mot de passe actuel',
      newPassword: 'Nouveau mot de passe',
      confirmPassword: 'Confirmer le mot de passe',
      updating: 'Mise a jour...',
      updatePasswordBtn: 'Mettre a jour le mot de passe',
      logoTitle: 'Logo entreprise',
      logoSubtitle: 'Utilise sur les devis et factures. Max 2 Mo — JPEG, PNG, WebP ou SVG.',
      uploadLogo: 'Telecharger le logo',
      replaceLogo: 'Remplacer le logo',
      deleteLogo: 'Supprimer le logo',
      deleteLogoTitle: 'Supprimer le logo entreprise ?',
      deleteLogoDesc: 'Le logo sera definitivement supprime de votre profil et des futurs documents.',
      cancel: 'Annuler',
      confirm: 'Supprimer',
      uploading: 'Telechargement...',
      deleting: 'Suppression...',
      logoUploaded: 'Logo telecharge',
      logoDeleted: 'Logo supprime',
      logoUploadFailed: 'Impossible de telecharger le logo',
      logoDeleteFailed: 'Impossible de supprimer le logo',
      logoTypeError: 'Type de fichier invalide. Accepte : JPEG, PNG, WebP, SVG',
      logoSizeError: 'Fichier trop volumineux. Taille maximale : 2 Mo',
    },
  }[locale];

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

  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoDeleting, setLogoDeleting] = useState(false);
  const [showDeleteLogoDialog, setShowDeleteLogoDialog] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

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
        setLogoUrl((data.profile as Record<string, unknown>)?.logoUrl as string | null ?? null);
      } catch (err) {
        setError(err instanceof Error ? err.message : t.loadFailed);
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [t.loadFailed]);

  function handleLogoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
      toast.error(t.logoTypeError);
      e.target.value = '';
      return;
    }
    if (file.size > MAX_LOGO_SIZE) {
      toast.error(t.logoSizeError);
      e.target.value = '';
      return;
    }
    void uploadLogo(file);
    e.target.value = '';
  }

  async function uploadLogo(file: File) {
    setLogoUploading(true);
    try {
      const presignResponse = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type,
          folder: 'logos',
        }),
      });

      const presignData = (await presignResponse.json()) as {
        success: boolean;
        message?: string;
        uploadUrl?: string;
        fileUrl?: string;
        key?: string;
      };

      if (!presignResponse.ok || !presignData.success || !presignData.uploadUrl || !presignData.fileUrl || !presignData.key) {
        throw new Error(presignData.message || t.logoUploadFailed);
      }

      const uploadResponse = await fetch(presignData.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error(t.logoUploadFailed);
      }

      const updateResponse = await fetch('/api/cprofile/logo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logoUrl: presignData.fileUrl, logoKey: presignData.key }),
      });
      const updateData = (await updateResponse.json()) as { success: boolean; message?: string; logoUrl?: string };

      if (!updateResponse.ok || !updateData.success) {
        throw new Error(updateData.message || t.logoUploadFailed);
      }

      setLogoUrl(updateData.logoUrl ?? presignData.fileUrl ?? null);
      toast.success(t.logoUploaded);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.logoUploadFailed);
    } finally {
      setLogoUploading(false);
    }
  }

  async function deleteLogo() {
    setLogoDeleting(true);
    try {
      const response = await fetch('/api/cprofile/logo', { method: 'DELETE' });
      const data = (await response.json()) as { success: boolean; message?: string };
      if (!response.ok || !data.success) throw new Error(data.message || t.logoDeleteFailed);
      setLogoUrl(null);
      toast.success(t.logoDeleted);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.logoDeleteFailed);
    } finally {
      setLogoDeleting(false);
      setShowDeleteLogoDialog(false);
    }
  }

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
      toast.success(t.saved);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  async function updatePassword() {
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      toast.error(t.passwordRequired);
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error(t.passwordMismatch);
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
        throw new Error(data.message || t.passwordUpdateFailed);
      }

      toast.success(t.passwordUpdated);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.passwordUpdateFailed);
    } finally {
      setPasswordSaving(false);
    }
  }

  return (
    <CrmShell title={t.shellTitle}>
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">{t.heading}</h1>
        <p className="text-sm text-muted-foreground">{t.subtitle}</p>
      </div>

      {/* Hidden file input for logo */}
      <input
        ref={logoInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/svg+xml"
        className="hidden"
        onChange={handleLogoFileChange}
      />

      {/* Logo card */}
      <Card id="company-logo" className="scroll-mt-20">
        <CardHeader className="border-b">
          <CardTitle>{t.logoTitle}</CardTitle>
          <p className="text-sm text-muted-foreground">{t.logoSubtitle}</p>
        </CardHeader>
        <CardContent className="pt-4">
          {loading ? (
            <div className="flex items-center gap-4">
              <Skeleton className="size-24 rounded-xl" />
              <Skeleton className="h-9 w-32" />
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-4">
              {/* Preview */}
              <div className="relative flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted">
                {logoUrl ? (
                  <Image
                    src={logoUrl}
                    alt="Company logo"
                    fill
                    className="object-contain p-1"
                    unoptimized
                  />
                ) : (
                  <BuildingIcon className="size-10 text-muted-foreground/40" />
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  className=''
                  size="sm"
                  disabled={logoUploading || logoDeleting}
                  onClick={() => logoInputRef.current?.click()}
                >
                  <UploadIcon />
                  {logoUploading ? t.uploading : logoUrl ? t.replaceLogo : t.uploadLogo}
                </Button>

                {logoUrl && (
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={logoDeleting || logoUploading}
                    onClick={() => setShowDeleteLogoDialog(true)}
                  >
                    <Trash2Icon />
                    {t.deleteLogo}
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete logo confirmation */}
      <AlertDialog open={showDeleteLogoDialog} onOpenChange={setShowDeleteLogoDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.deleteLogoTitle}</AlertDialogTitle>
            <AlertDialogDescription>{t.deleteLogoDesc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button variant="outline">{t.cancel}</Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                variant="destructive"
                disabled={logoDeleting}
                onClick={(e) => { e.preventDefault(); void deleteLogo(); }}
              >
                {logoDeleting ? t.deleting : t.confirm}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card id="company-profile" className="scroll-mt-20">
        <CardHeader className="border-b">
          <CardTitle>{exists ? t.updateTitle : t.createTitle}</CardTitle>
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
                <Label>{t.companyName}</Label>
                <Input value={form.companyName} onChange={(e) => setForm((p) => ({ ...p, companyName: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>{t.ownerName}</Label>
                <Input value={form.ownerName} onChange={(e) => setForm((p) => ({ ...p, ownerName: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>{t.phone}</Label>
                <Input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>{t.businessEmail}</Label>
                <Input type="email" value={form.businessEmail} onChange={(e) => setForm((p) => ({ ...p, businessEmail: e.target.value }))} />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label>{t.address}</Label>
                <Input value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>{t.vat}</Label>
                <Input value={form.vatNumber} onChange={(e) => setForm((p) => ({ ...p, vatNumber: e.target.value }))} />
              </div>
            </div>
          )}

          <div className="mt-4">
            <Button onClick={saveProfile} disabled={saving || loading} className='h-10 w-full lg:w-auto md:w-auto '>
              <SaveIcon />
              {saving ? t.saving : t.saveProfile}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card id="password-security" className="scroll-mt-20">
        <CardHeader className="border-b">
          <CardTitle>{t.updatePassword}</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1.5 md:col-span-2">
              <Label>{t.currentPassword}</Label>
              <Input
                type="password"
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm((p) => ({ ...p, currentPassword: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t.newPassword}</Label>
              <Input
                type="password"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm((p) => ({ ...p, newPassword: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t.confirmPassword}</Label>
              <Input
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm((p) => ({ ...p, confirmPassword: e.target.value }))}
              />
            </div>
          </div>

          <div className="mt-4">
            <Button onClick={updatePassword} disabled={passwordSaving} className='h-10 w-full lg:w-auto md:w-auto '>
              <SaveIcon />
              {passwordSaving ? t.updating : t.updatePasswordBtn}
            </Button>
          </div>
        </CardContent>
      </Card>
    </CrmShell>
  );
}
