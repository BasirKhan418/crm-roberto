'use client';

import Link from 'next/link';
import { ChangeEvent, DragEvent, useMemo, useRef, useState } from 'react';

import {
  CameraIcon,
  CheckCircle2Icon,
  CopyIcon,
  ExternalLinkIcon,
  FilePlus2Icon,
  Loader2Icon,
  MailIcon,
  RefreshCwIcon,
  UploadIcon,
} from 'lucide-react';

import CrmShell from '@/components/crm-shell';
import { ExpenseMoneyDisplay } from '@/components/expenses/expense-money-display';
import { ExpenseStatusBadge } from '@/components/expenses/expense-status-badge';
import { useLocale } from '@/components/providers/locale-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import EmptyState from '@/components/ui/EmptyState';
import ErrorMessage from '@/components/ui/ErrorMessage';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuthMe } from '@/hooks/useAuthMe';
import { useExpenses } from '@/hooks/useExpenses';
import { hasPermission } from '@/lib/permissions';
import {
  EXPENSE_ALLOWED_MIME_TYPES,
  EXPENSE_MAX_FILE_SIZE_BYTES,
  formatFileSizeMb,
  getExpenseFileExtension,
  isExpenseMimeTypeAllowed,
} from '@/lib/expenses/upload';
import { useIsMobile } from '@/hooks/use-mobile';

type UploadStatus =
  | 'queued'
  | 'presigning'
  | 'uploading'
  | 'creating_draft'
  | 'success'
  | 'error';

type UploadItem = {
  id: string;
  file: File;
  fileName: string;
  status: UploadStatus;
  progress: number;
  source: 'photo' | 'import' | 'drop';
  error: string | null;
  expenseId: string | null;
};

type PresignResponse = {
  success: boolean;
  message?: string;
  uploadUrl?: string;
  fileUrl?: string;
  key?: string;
};

type DraftResponse = {
  success: boolean;
  message?: string;
  expense?: { _id?: string };
};

const extensionToMime: Record<string, (typeof EXPENSE_ALLOWED_MIME_TYPES)[number]> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic',
};

const ACCEPTED_FILES = '.pdf,.jpg,.jpeg,.png,.heic';

function createUploadId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function inferMimeType(file: File): (typeof EXPENSE_ALLOWED_MIME_TYPES)[number] | null {
  if (isExpenseMimeTypeAllowed(file.type)) {
    return file.type as (typeof EXPENSE_ALLOWED_MIME_TYPES)[number];
  }

  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  return extensionToMime[extension] || null;
}

function formatUploadStatus(status: UploadStatus, locale: 'en' | 'fr') {
  const labels = {
    en: {
      queued: 'Queued',
      presigning: 'Preparing upload',
      uploading: 'Uploading file',
      creating_draft: 'Creating draft',
      success: 'Draft created',
      error: 'Failed',
    },
    fr: {
      queued: 'En attente',
      presigning: 'Preparation de l\'upload',
      uploading: 'Envoi du fichier',
      creating_draft: 'Creation du brouillon',
      success: 'Brouillon cree',
      error: 'Echec',
    },
  } as const;

  return labels[locale][status];
}

function formatDateDisplay(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('fr-FR');
}

export default function ExpensesPage() {
  const { locale } = useLocale();
  const { user, loading: authLoading } = useAuthMe();
  const { expenses, loading, error, refetch } = useExpenses({
    page: 1,
    limit: 20,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });
  const isMobile = useIsMobile();

  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const canViewExpenses = hasPermission(user?.role, 'expenses.view');
  const canManageExpenses = hasPermission(user?.role, 'expenses.manage');

  const t = {
    en: {
      shellTitle: 'Expenses',
      heading: 'Expenses Workspace',
      subtitle: 'Capture receipts and invoices from files, camera, or drag and drop to generate draft expenses.',
      forbiddenTitle: 'You do not have access to expenses',
      forbiddenHelp: 'Ask an administrator to grant expenses permissions.',
      takePhoto: 'Take photo',
      takePhotoHint: 'Mobile-first capture for receipts.',
      importFile: 'Import file',
      importFileHint: 'Upload PDF/JPEG/PNG/HEIC and create one draft per file.',
      forwardEmail: 'Forward email',
      forwardEmailHint: 'Mailbox ingestion placeholder is ready for Milestone 2 integration.',
      dragDrop: 'Drag and drop',
      dragDropHint: 'Drop files here on desktop to create draft expenses quickly.',
      dragDropMobileHint: 'Desktop entry point. Use Import or Take photo on mobile.',
      createManual: 'Create manually',
      createManualHint: 'Opens a placeholder until Sprint 4 full form is delivered.',
      copy: 'Copy',
      copied: 'Copied',
      pendingSetup: 'Setup pending',
      browseFiles: 'Browse files',
      choosePhoto: 'Capture photo',
      manualModalTitle: 'Manual Entry Placeholder',
      manualModalDescription: 'Sprint 3 keeps this as a placeholder. Sprint 4 will ship the complete manual expense form.',
      close: 'Close',
      uploadQueueTitle: 'Upload Queue',
      uploadQueueSubtitle: 'Track progress, retry failures, and open created drafts.',
      retry: 'Retry',
      openDraft: 'Open draft',
      recentExpensesTitle: 'Recent Expenses',
      recentExpensesSubtitle: 'Latest expenses and drafts from your company scope.',
      refresh: 'Refresh',
      noExpenses: 'No expenses yet. Start by importing a receipt or creating one manually.',
      tableDate: 'Date',
      tableReference: 'Reference',
      tableAmount: 'Incl. VAT',
      tableStatus: 'Status',
      tableAction: 'Action',
      open: 'Open',
      fileTooLarge: `File too large. Maximum ${formatFileSizeMb(EXPENSE_MAX_FILE_SIZE_BYTES)} MB`,
      unsupportedFile: 'Unsupported file type. Allowed: PDF, JPEG, PNG, HEIC.',
      failedPresign: 'Unable to create upload URL',
      failedUpload: 'File upload failed',
      failedDraft: 'Unable to create draft expense',
      copiedEmail: 'Forward address copied',
      mobileCaptureNote: 'If camera capture is not supported on your browser, choose an image file manually.',
    },
    fr: {
      shellTitle: 'Depenses',
      heading: 'Espace Depenses',
      subtitle: 'Capturez les recus et factures depuis un fichier, la camera, ou le glisser-deposer pour creer des brouillons.',
      forbiddenTitle: "Vous n'avez pas acces aux depenses",
      forbiddenHelp: "Demandez a un administrateur d'activer les permissions depenses.",
      takePhoto: 'Prendre une photo',
      takePhotoHint: 'Capture mobile pour les recus.',
      importFile: 'Importer un fichier',
      importFileHint: 'Upload PDF/JPEG/PNG/HEIC et creation d\'un brouillon par fichier.',
      forwardEmail: 'Transferer par email',
      forwardEmailHint: "Le placeholder d'ingestion email est pret pour l'integration Milestone 2.",
      dragDrop: 'Glisser-deposer',
      dragDropHint: 'Deposez des fichiers ici sur desktop pour creer des brouillons.',
      dragDropMobileHint: 'Point d\'entree desktop. Utilisez Importer ou Photo sur mobile.',
      createManual: 'Creer manuellement',
      createManualHint: 'Placeholder jusqu\'au formulaire complet Sprint 4.',
      copy: 'Copier',
      copied: 'Copie',
      pendingSetup: 'Configuration en attente',
      browseFiles: 'Parcourir',
      choosePhoto: 'Capturer',
      manualModalTitle: 'Placeholder Saisie Manuelle',
      manualModalDescription: 'Sprint 3 garde un placeholder. Sprint 4 livrera le formulaire complet de depense.',
      close: 'Fermer',
      uploadQueueTitle: 'File d\'upload',
      uploadQueueSubtitle: 'Suivez la progression, relancez les echecs, et ouvrez les brouillons crees.',
      retry: 'Relancer',
      openDraft: 'Ouvrir brouillon',
      recentExpensesTitle: 'Depenses recentes',
      recentExpensesSubtitle: 'Dernieres depenses et brouillons dans le scope de votre societe.',
      refresh: 'Actualiser',
      noExpenses: 'Aucune depense. Commencez par importer un recu ou creer une depense manuelle.',
      tableDate: 'Date',
      tableReference: 'Reference',
      tableAmount: 'TTC',
      tableStatus: 'Statut',
      tableAction: 'Action',
      open: 'Ouvrir',
      fileTooLarge: `Fichier trop volumineux. Maximum ${formatFileSizeMb(EXPENSE_MAX_FILE_SIZE_BYTES)} MB`,
      unsupportedFile: 'Type de fichier non supporte. Autorises: PDF, JPEG, PNG, HEIC.',
      failedPresign: "Impossible de generer l'URL d'upload",
      failedUpload: "Echec de l'upload",
      failedDraft: 'Impossible de creer le brouillon',
      copiedEmail: 'Adresse de transfert copiee',
      mobileCaptureNote: 'Si la capture camera n\'est pas supportee par votre navigateur, choisissez une image manuellement.',
    },
  }[locale];

  const forwardAddress = useMemo(() => {
    if (!user?.companyId) {
      return 'expenses@ingest.crm-roberto.local';
    }

    return `expenses+${user.companyId}@ingest.crm-roberto.local`;
  }, [user?.companyId]);

  function updateUploadItem(id: string, patch: Partial<UploadItem>) {
    setUploads((previous) =>
      previous.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  }

  function resetInputValue(event: ChangeEvent<HTMLInputElement>) {
    event.target.value = '';
  }

  function validateFile(file: File): { mimeType: string | null; error: string | null } {
    if (file.size > EXPENSE_MAX_FILE_SIZE_BYTES) {
      return { mimeType: null, error: t.fileTooLarge };
    }

    const mimeType = inferMimeType(file);
    if (!mimeType) {
      return { mimeType: null, error: t.unsupportedFile };
    }

    return { mimeType, error: null };
  }

  async function createDraftFromFile(uploadId: string, file: File) {
    const validation = validateFile(file);
    if (validation.error || !validation.mimeType) {
      updateUploadItem(uploadId, {
        status: 'error',
        progress: 100,
        error: validation.error || t.unsupportedFile,
      });
      return;
    }

    try {
      updateUploadItem(uploadId, {
        status: 'presigning',
        progress: 20,
        error: null,
      });

      const presignResponse = await fetch('/api/expenses/upload-presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          fileType: validation.mimeType,
          fileSize: file.size,
        }),
      });

      const presignPayload = (await presignResponse.json().catch(() => null)) as PresignResponse | null;
      if (
        !presignResponse.ok ||
        !presignPayload?.success ||
        !presignPayload.uploadUrl ||
        !presignPayload.fileUrl ||
        !presignPayload.key
      ) {
        throw new Error(presignPayload?.message || t.failedPresign);
      }

      updateUploadItem(uploadId, {
        status: 'uploading',
        progress: 55,
      });

      const uploadResponse = await fetch(presignPayload.uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': validation.mimeType,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error(t.failedUpload);
      }

      updateUploadItem(uploadId, {
        status: 'creating_draft',
        progress: 80,
      });

      const extension = getExpenseFileExtension(file.name, validation.mimeType);

      const draftResponse = await fetch('/api/expenses/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attachment: {
            originalName: file.name,
            displayName: file.name,
            mimeType: validation.mimeType,
            extension,
            sizeBytes: file.size,
            storageKey: presignPayload.key,
            url: presignPayload.fileUrl,
            checksum: null,
          },
        }),
      });

      const draftPayload = (await draftResponse.json().catch(() => null)) as DraftResponse | null;
      if (!draftResponse.ok || !draftPayload?.success || !draftPayload.expense?._id) {
        throw new Error(draftPayload?.message || t.failedDraft);
      }

      updateUploadItem(uploadId, {
        status: 'success',
        progress: 100,
        expenseId: draftPayload.expense._id,
      });

      void refetch();
    } catch (error) {
      updateUploadItem(uploadId, {
        status: 'error',
        progress: 100,
        error: error instanceof Error ? error.message : t.failedDraft,
      });
    }
  }

  function queueFiles(files: FileList | null, source: UploadItem['source']) {
    if (!files || files.length === 0 || !canManageExpenses) {
      return;
    }

    const newItems: UploadItem[] = Array.from(files).map((file) => ({
      id: createUploadId(),
      file,
      fileName: file.name,
      status: 'queued',
      progress: 0,
      source,
      error: null,
      expenseId: null,
    }));

    setUploads((previous) => [...newItems, ...previous]);

    for (const item of newItems) {
      void createDraftFromFile(item.id, item.file);
    }
  }

  function onPhotoSelected(event: ChangeEvent<HTMLInputElement>) {
    queueFiles(event.target.files, 'photo');
    resetInputValue(event);
  }

  function onImportSelected(event: ChangeEvent<HTMLInputElement>) {
    queueFiles(event.target.files, 'import');
    resetInputValue(event);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragActive(false);
    queueFiles(event.dataTransfer.files, 'drop');
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (!isMobile) {
      setIsDragActive(true);
    }
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragActive(false);
  }

  async function copyForwardAddress() {
    try {
      await navigator.clipboard.writeText(forwardAddress);
      setCopyFeedback(t.copiedEmail);
      window.setTimeout(() => setCopyFeedback(null), 2000);
    } catch {
      setCopyFeedback(null);
    }
  }

  if (authLoading) {
    return (
      <CrmShell title={t.shellTitle}>
        <div className="flex min-h-52 items-center justify-center">
          <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
        </div>
      </CrmShell>
    );
  }

  if (!canViewExpenses) {
    return (
      <CrmShell title={t.shellTitle}>
        <Card className="border-border/70">
          <CardHeader>
            <CardTitle className="text-lg">{t.forbiddenTitle}</CardTitle>
            <CardDescription>{t.forbiddenHelp}</CardDescription>
          </CardHeader>
        </Card>
      </CrmShell>
    );
  }

  return (
    <CrmShell title={t.shellTitle}>
      <div className="space-y-5">
        <section className="space-y-1.5">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">{t.heading}</h1>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
          <p className="text-xs text-muted-foreground">{t.mobileCaptureNote}</p>
        </section>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Card className="border-border/70">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t.takePhoto}</CardTitle>
              <CardDescription>{t.takePhotoHint}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                type="button"
                className="w-full"
                onClick={() => photoInputRef.current?.click()}
                disabled={!canManageExpenses}
              >
                <CameraIcon className="size-4" />
                {t.choosePhoto}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border/70">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t.importFile}</CardTitle>
              <CardDescription>{t.importFileHint}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                type="button"
                className="w-full"
                variant="outline"
                onClick={() => importInputRef.current?.click()}
                disabled={!canManageExpenses}
              >
                <UploadIcon className="size-4" />
                {t.browseFiles}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border/70">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t.forwardEmail}</CardTitle>
              <CardDescription>{t.forwardEmailHint}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="rounded-lg border border-border/60 bg-muted/30 px-2 py-1.5 text-xs font-medium text-foreground/80">
                {forwardAddress}
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={copyForwardAddress}>
                  <CopyIcon className="size-3.5" />
                  {copyFeedback ? t.copied : t.copy}
                </Button>
                <span className="text-[11px] text-muted-foreground">{t.pendingSetup}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t.dragDrop}</CardTitle>
              <CardDescription>{isMobile ? t.dragDropMobileHint : t.dragDropHint}</CardDescription>
            </CardHeader>
            <CardContent>
              <div
                role="presentation"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`flex min-h-24 items-center justify-center rounded-lg border border-dashed px-3 text-xs transition ${
                  isMobile
                    ? 'border-border/50 bg-muted/20 text-muted-foreground'
                    : isDragActive
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border/70 bg-muted/10 text-muted-foreground'
                }`}
              >
                {isMobile ? t.dragDropMobileHint : t.dragDropHint}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t.createManual}</CardTitle>
              <CardDescription>{t.createManualHint}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                type="button"
                className="w-full"
                variant="secondary"
                onClick={() => setManualModalOpen(true)}
                disabled={!canManageExpenses}
              >
                <FilePlus2Icon className="size-4" />
                {t.createManual}
              </Button>
            </CardContent>
          </Card>
        </section>

        <input
          ref={photoInputRef}
          type="file"
          className="hidden"
          accept="image/*"
          capture="environment"
          onChange={onPhotoSelected}
          disabled={!canManageExpenses}
        />

        <input
          ref={importInputRef}
          type="file"
          className="hidden"
          accept={ACCEPTED_FILES}
          multiple
          onChange={onImportSelected}
          disabled={!canManageExpenses}
        />

        {uploads.length > 0 ? (
          <Card className="border-border/70">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t.uploadQueueTitle}</CardTitle>
              <CardDescription>{t.uploadQueueSubtitle}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {uploads.map((item) => (
                <div key={item.id} className="rounded-lg border border-border/60 p-2.5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{item.fileName}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatUploadStatus(item.status, locale)}
                        {item.source === 'photo' ? ' • camera' : item.source === 'drop' ? ' • drag/drop' : ' • import'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.status === 'success' ? (
                        <CheckCircle2Icon className="size-4 text-emerald-600" />
                      ) : item.status === 'error' ? (
                        <span className="text-xs text-destructive">{item.error}</span>
                      ) : (
                        <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
                      )}
                    </div>
                  </div>

                  <div className="mt-2 h-1.5 w-full rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full ${
                        item.status === 'error' ? 'bg-destructive' : 'bg-primary'
                      }`}
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    {item.status === 'error' ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void createDraftFromFile(item.id, item.file)}
                      >
                        <RefreshCwIcon className="size-3.5" />
                        {t.retry}
                      </Button>
                    ) : null}

                    {item.status === 'success' && item.expenseId ? (
                      <Button asChild type="button" variant="outline" size="sm">
                        <Link href={`/expenses/${item.expenseId}`}>
                          <ExternalLinkIcon className="size-3.5" />
                          {t.openDraft}
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}

        <Card className="border-border/70">
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base">{t.recentExpensesTitle}</CardTitle>
                <CardDescription>{t.recentExpensesSubtitle}</CardDescription>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>
                <RefreshCwIcon className="size-3.5" />
                {t.refresh}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              <div className="flex min-h-28 items-center justify-center">
                <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <ErrorMessage message={error} />
            ) : expenses.length === 0 ? (
              <EmptyState message={t.noExpenses} />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.tableDate}</TableHead>
                    <TableHead>{t.tableReference}</TableHead>
                    <TableHead>{t.tableAmount}</TableHead>
                    <TableHead>{t.tableStatus}</TableHead>
                    <TableHead>{t.tableAction}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map((expense) => (
                    <TableRow key={expense._id}>
                      <TableCell>{formatDateDisplay(expense.expenseDate)}</TableCell>
                      <TableCell className="max-w-52 truncate">{expense.supplierRef || '-'}</TableCell>
                      <TableCell>
                        <ExpenseMoneyDisplay cents={expense.amountInclVatCents || 0} locale={locale === 'fr' ? 'fr-FR' : 'en-GB'} />
                      </TableCell>
                      <TableCell>
                        <ExpenseStatusBadge status={expense.status} paymentStatus={expense.paymentStatus} />
                      </TableCell>
                      <TableCell>
                        <Button asChild type="button" variant="ghost" size="sm">
                          <Link href={`/expenses/${expense._id}`}>{t.open}</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={manualModalOpen} onOpenChange={setManualModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.manualModalTitle}</DialogTitle>
            <DialogDescription>{t.manualModalDescription}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" onClick={() => setManualModalOpen(false)}>
              <MailIcon className="size-4" />
              {t.close}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </CrmShell>
  );
}
