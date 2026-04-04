'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { ArrowUpRightIcon, BanknoteIcon, BuildingIcon, CompassIcon, CreditCardIcon, SaveIcon, ShieldCheckIcon, Trash2Icon, UploadIcon } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { toast } from 'sonner';

import CrmShell from '@/components/crm-shell';
import { useLocale } from '@/components/providers/locale-provider';
import { resolveTranslatedError, translate } from '@/lib/i18n/messages';
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
  const router = useRouter();
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
      stripeTitle: 'Stripe payments',
      stripeSubtitle: 'Connect Stripe to receive online invoice payments directly to your bank account.',
      stripeCta: 'Manage Stripe settings',
      stripeFeatureSettlement: 'Direct settlement to your bank account',
      stripeFeatureSecurity: 'Secure checkout hosted by Stripe',
      stripeFeatureAutomation: 'Automatic invoice payment tracking',
      restartTour: 'Take a platform tour',
      restartingTour: 'Preparing tour...',
      restartTourHint: 'Resets all onboarding tips and starts the guided experience again from dashboard.',
      restartTourSuccess: 'Tour reset. Redirecting to dashboard...',
      restartTourFailed: 'Unable to restart platform tour',
    },
    fr: {
      loadFailed: 'Impossible de charger le profil',
      saveFailed: "Impossible d'enregistrer le profil",
      saved: 'Profil entreprise enregistr\u00e9',
      passwordRequired: 'Tous les champs de mot de passe sont requis',
      passwordMismatch: 'Le nouveau mot de passe et la confirmation doivent correspondre',
      passwordUpdateFailed: 'Impossible de mettre \u00e0 jour le mot de passe',
      passwordUpdated: 'Mot de passe mis \u00e0 jour avec succ\u00e8s',
      shellTitle: 'Profil entreprise',
      heading: 'Profil entreprise',
      subtitle: "Configurez l'identit\u00e9 de votre entreprise et les coordonn\u00e9es.",
      updateTitle: 'Mettre \u00e0 jour le profil entreprise',
      createTitle: 'Cr\u00e9er le profil entreprise',
      companyName: "Nom de l'entreprise",
      ownerName: 'Nom du propri\u00e9taire',
      phone: 'T\u00e9l\u00e9phone',
      businessEmail: 'E-mail professionnel',
      address: 'Adresse',
      vat: 'Num\u00e9ro de TVA',
      saving: 'Enregistrement...',
      saveProfile: 'Enregistrer le profil',
      updatePassword: 'Mettre \u00e0 jour le mot de passe',
      currentPassword: 'Mot de passe actuel',
      newPassword: 'Nouveau mot de passe',
      confirmPassword: 'Confirmer le mot de passe',
      updating: 'Mise \u00e0 jour...',
      updatePasswordBtn: 'Mettre \u00e0 jour le mot de passe',
      logoTitle: 'Logo entreprise',
      logoSubtitle: 'Utilis\u00e9 sur les devis et factures. Max 2 Mo \u2014 JPEG, PNG, WebP ou SVG.',
      uploadLogo: 'T\u00e9l\u00e9charger le logo',
      replaceLogo: 'Remplacer le logo',
      deleteLogo: 'Supprimer le logo',
      deleteLogoTitle: 'Supprimer le logo entreprise\u00a0?',
      deleteLogoDesc: 'Le logo sera d\u00e9finitivement supprim\u00e9 de votre profil et des futurs documents.',
      cancel: 'Annuler',
      confirm: 'Supprimer',
      uploading: 'T\u00e9l\u00e9chargement...',
      deleting: 'Suppression...',
      logoUploaded: 'Logo t\u00e9l\u00e9charg\u00e9',
      logoDeleted: 'Logo supprim\u00e9',
      logoUploadFailed: 'Impossible de t\u00e9l\u00e9charger le logo',
      logoDeleteFailed: 'Impossible de supprimer le logo',
      logoTypeError: 'Type de fichier invalide. Accept\u00e9\u00a0: JPEG, PNG, WebP, SVG',
      logoSizeError: 'Fichier trop volumineux. Taille maximale\u00a0: 2 Mo',
      stripeTitle: 'Paiements Stripe',
      stripeSubtitle: 'Connectez Stripe pour recevoir les paiements de factures en ligne directement sur votre compte bancaire.',
      stripeCta: 'G\u00e9rer les param\u00e8tres Stripe',
      stripeFeatureSettlement: 'Versement direct vers votre compte bancaire',
      stripeFeatureSecurity: 'Paiement s\u00e9curis\u00e9 h\u00e9berg\u00e9 par Stripe',
      stripeFeatureAutomation: 'Suivi automatique des paiements de factures',
      restartTour: 'Reprendre la visite de la plateforme',
      restartingTour: 'Préparation de la visite...',
      restartTourHint: 'Réinitialise tous les guides et relance l\'expérience guidée depuis le tableau de bord.',
      restartTourSuccess: 'Visite réinitialisée. Redirection vers le tableau de bord...',
      restartTourFailed: 'Impossible de relancer la visite de la plateforme',
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
  const [resettingTour, setResettingTour] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  async function handleRestartPlatformTour() {
    setResettingTour(true);
    try {
      const response = await fetch('/api/onboarding/guide', { method: 'DELETE' });
      const payload = (await response.json()) as { success?: boolean; message?: string };
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || t.restartTourFailed);
      }

      toast.success(t.restartTourSuccess);
      router.push('/dashboard');
    } catch (error) {
      toast.error(resolveTranslatedError(locale, error, t.restartTourFailed));
    } finally {
      setResettingTour(false);
    }
  }

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
      toast.error(resolveTranslatedError(locale, err, t.logoUploadFailed));
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
      toast.error(resolveTranslatedError(locale, err, t.logoDeleteFailed));
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
      toast.error(resolveTranslatedError(locale, err, t.saveFailed));
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
      toast.error(resolveTranslatedError(locale, err, t.passwordUpdateFailed));
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
      <Card id="company-logo" data-tour-profile-logo-card className="scroll-mt-20">
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
                    alt={translate(locale, 'common.companyLogo')}
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
                  data-tour-profile-logo-upload
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

              <div className="w-full rounded-xl border border-sky-300/70 bg-sky-50/70 p-3 dark:border-sky-900/50 dark:bg-sky-950/20">
                <p className="mb-2 text-xs text-sky-800 dark:text-sky-200">{t.restartTourHint}</p>
                <Button
                  type="button"
                  variant="default"
                  data-tour-profile-restart-tour
                  className="h-10 w-full bg-sky-700 text-white hover:bg-sky-800 dark:bg-sky-600 dark:hover:bg-sky-500"
                  disabled={resettingTour}
                  onClick={() => void handleRestartPlatformTour()}
                >
                  <CompassIcon className="size-4" />
                  {resettingTour ? t.restartingTour : t.restartTour}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card id="stripe-payments" data-tour-profile-stripe-card className="scroll-mt-20 overflow-hidden border-primary/20 bg-linear-to-br from-sky-50/70 via-background to-indigo-50/40 dark:from-sky-950/20 dark:to-indigo-950/20">
        <CardHeader className="border-b">
          <CardTitle>{t.stripeTitle}</CardTitle>
          <p className="text-sm text-muted-foreground">{t.stripeSubtitle}</p>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid gap-4 rounded-2xl border border-sky-200/70 bg-white/80 p-4 shadow-sm backdrop-blur-sm dark:border-sky-900/60 dark:bg-slate-950/40 md:grid-cols-[1fr_auto] md:items-center">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-300/70 bg-sky-100/70 px-3 py-1 text-xs font-medium text-sky-800 dark:border-sky-800 dark:bg-sky-900/30 dark:text-sky-200">
                <CreditCardIcon className="size-3.5" />
                Stripe Connect
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-200/80 bg-background/80 p-3 dark:border-slate-800">
                  <div className="mb-1 inline-flex size-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                    <BanknoteIcon className="size-4" />
                  </div>
                  <p className="text-xs text-muted-foreground">{t.stripeFeatureSettlement}</p>
                </div>
                <div className="rounded-xl border border-slate-200/80 bg-background/80 p-3 dark:border-slate-800">
                  <div className="mb-1 inline-flex size-7 items-center justify-center rounded-lg bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                    <ShieldCheckIcon className="size-4" />
                  </div>
                  <p className="text-xs text-muted-foreground">{t.stripeFeatureSecurity}</p>
                </div>
                <div className="rounded-xl border border-slate-200/80 bg-background/80 p-3 dark:border-slate-800">
                  <div className="mb-1 inline-flex size-7 items-center justify-center rounded-lg bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">
                    <BuildingIcon className="size-4" />
                  </div>
                  <p className="text-xs text-muted-foreground">{t.stripeFeatureAutomation}</p>
                </div>
              </div>
            </div>

            <Button asChild data-tour-profile-stripe-cta className="h-11 min-w-52 rounded-xl px-5">
              <Link href="/settings/stripe">
                {t.stripeCta}
                <ArrowUpRightIcon className="size-4" />
              </Link>
            </Button>
          </div>
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

      <Card id="company-profile" data-tour-profile-company-card className="scroll-mt-20">
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
            <Button data-tour-profile-save onClick={saveProfile} disabled={saving || loading} className='h-10 w-full lg:w-auto md:w-auto '>
              <SaveIcon />
              {saving ? t.saving : t.saveProfile}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card id="password-security" data-tour-profile-password-card className="scroll-mt-20">
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
