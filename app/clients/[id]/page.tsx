'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';

import {
  AlertTriangleIcon,
  Building2Icon,
  CalendarClockIcon,
  ClipboardListIcon,
  ClockIcon,
  EyeIcon,
  FilePlusIcon,
  FileTextIcon,
  MailIcon,
  MessageSquareIcon,
  PencilIcon,
  PhoneCallIcon,
  PlusIcon,
  ReceiptIcon,
  SendIcon,
  StickyNoteIcon,
  Trash2Icon,
  TrendingUpIcon,
  UploadCloudIcon,
  UserIcon,
  VideoIcon,
} from 'lucide-react';
import { toast } from 'sonner';

import CrmShell from '@/components/crm-shell';
import AddClientModal from '@/components/modals/AddClientModal';
import SendQuoteModal from '@/components/quotes/SendQuoteModal';
import QuoteStatusSummary from '@/components/quotes/QuoteStatusSummary';
import { useLocale } from '@/components/providers/locale-provider';
import { resolveTranslatedError } from '@/lib/i18n/messages';
import { PriceDisplay } from '@/components/ui/PriceDisplay';
import type { QuoteStatus } from '@/components/ui/StatusBadge';
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
import EmptyState from '@/components/ui/EmptyState';
import ErrorMessage from '@/components/ui/ErrorMessage';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';


interface ClientRecord {
  _id: string;
  clientType?: 'company' | 'individual';
  fullName: string;
  title?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  addressDetails?: {
    street?: string | null;
    postalCode?: string | null;
    city?: string | null;
    country?: string | null;
  } | null;
  companyName?: string | null;
  vatNumber?: string | null;
  rcsNumber?: string | null;
  businessAuthorizationNumber?: string | null;
  matriculeNumber?: string | null;
  bankName?: string | null;
  iban?: string | null;
  responsibleEmail?: string | null;
  billingEmail?: string | null;
  companyPhone?: string | null;
  privatePhone?: string | null;
  mobilePhone?: string | null;
  additionalDescription?: string | null;
  billingAddress?: string | null;
}

interface NoteItem {
  _id: string;
  title: string;
  description: string;
  createdAt: string;
  followUpDate?: string | null;
}

interface ClientQuote {
  _id: string;
  quoteNumber: string;
  date: string;
  status: QuoteStatus;
  statusChangedAt?: string | null;
  convertedToInvoice?: boolean;
  invoiceId?: string | null;
  totalIncludingTax: number;
}

type InteractionType = 'call' | 'meeting' | 'email' | 'discussion';

interface InteractionItem {
  _id: string;
  type: InteractionType;
  title: string;
  notes?: string | null;
  date: string;
  followUpDate?: string | null;
  createdAt: string;
}

interface AttachmentItem {
  _id: string;
  fileName: string;
  fileUrl: string;
  fileType?: string | null;
  fileSize?: number | null;
  createdAt: string;
}

interface DetailResponse {
  success: boolean;
  message?: string;
  data?: {
    client: ClientRecord;
    timeline: NoteItem[];
    interactions: InteractionItem[];
    attachments: AttachmentItem[];
  };
}


const INTERACTION_ICONS: Record<InteractionType, React.ReactNode> = {
  call: <PhoneCallIcon className="size-3.5" />,
  meeting: <VideoIcon className="size-3.5" />,
  email: <MailIcon className="size-3.5" />,
  discussion: <MessageSquareIcon className="size-3.5" />,
};

const INTERACTION_COLORS: Record<InteractionType, string> = {
  call: 'border-l-violet-400 bg-violet-50/60 dark:bg-violet-950/20',
  meeting: 'border-l-sky-400 bg-sky-50/60 dark:bg-sky-950/20',
  email: 'border-l-amber-400 bg-amber-50/60 dark:bg-amber-950/20',
  discussion: 'border-l-teal-400 bg-teal-50/60 dark:bg-teal-950/20',
};

const INTERACTION_DOT_COLORS: Record<InteractionType, string> = {
  call: 'bg-violet-400',
  meeting: 'bg-sky-400',
  email: 'bg-amber-400',
  discussion: 'bg-teal-400',
};

function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageType(fileType: string | null | undefined): boolean {
  return Boolean(fileType && fileType.startsWith('image/'));
}


export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { locale } = useLocale();

  const t = {
    en: {
      shellTitle: 'Client',
      notFound: 'Client not found.',
      loadFailed: 'Failed to load client details',
      updateFailed: 'Failed to update client',
      updated: 'Client updated',
      deleteFailed: 'Failed to delete client',
      deleted: 'Client deleted',
      noteValidation: 'Title and description are required',
      noteAddFailed: 'Failed to add note',
      noteAdded: 'Note added',
      noteUpdateFailed: 'Failed to update note',
      noteUpdated: 'Note updated',
      profile: 'Profile',
      billing: 'Billing',
      timeline: 'Timeline',
      notes: 'Notes & Tasks',
      interactions: 'Interactions',
      attachments: 'Attachments',
      createQuote: 'Create Quote',
      createInvoice: 'Create Invoice',
      addNote: 'Add Note',
      addInteraction: 'Log Interaction',
      uploadFile: 'Upload File',
      edit: 'Edit',
      delete: 'Delete',
      cancel: 'Cancel',
      saving: 'Saving...',
      saveChanges: 'Save changes',
      deleteTitle: 'Delete client?',
      deleteDesc: 'This permanently deletes the client and all linked notes.',
      deleting: 'Deleting...',
      deleteClient: 'Delete client',
      editClient: 'Edit Client',
      editClientDesc: 'Update core profile fields.',
      clientType: 'Client Type',
      companyType: 'Company',
      individualType: 'Individual',
      titleLabel: 'Title',
      firstName: 'First Name',
      lastName: 'Last Name',
      companyNameLabel: 'Company Name',
      vatNumber: 'VAT Number',
      rcsNumber: 'RCS Number',
      businessAuthorizationNumber: 'Business Authorization Number',
      matriculeNumber: 'Matricule Number',
      street: 'Street',
      postalCode: 'Postal Code',
      city: 'City',
      country: 'Country',
      bankName: 'Bank Name',
      iban: 'IBAN',
      responsibleEmail: 'Responsible Email',
      companyPhone: 'Company Phone',
      privatePhone: 'Private Phone',
      mobilePhone: 'Mobile Phone',
      additionalDescription: 'Additional Description',
      name: 'Name',
      email: 'Email',
      phone: 'Phone',
      address: 'Address',
      company: 'Company',
      vatTax: 'VAT / Tax ID',
      billingEmail: 'Billing Email',
      billingAddress: 'Billing Address',
      sameAsMain: 'Same as main',
      addNoteTitle: 'Add Note / Task',
      addNoteDesc: 'This note is automatically linked to this client.',
      title: 'Title',
      description: 'Description',
      followUpDate: 'Follow-up date',
      saveNote: 'Save note',
      editNote: 'Edit Note',
      editNoteDesc: 'Update this client note.',
      noTimeline: 'No activity yet. Create a quote, add a note, or log an interaction.',
      noNotes: 'No notes yet. Add a note to track tasks and follow-ups.',
      noInteractions: 'No interactions yet. Log a call, meeting, email or discussion.',
      noAttachments: 'No attachments yet. Upload contracts, PDFs, or other files.',
      pendingTasks: 'Pending & Upcoming Tasks',
      overdue: 'Overdue',
      upcoming: 'Upcoming',
      totalRevenue: 'Revenue (accepted)',
      totalQuotes: 'Quotes',
      notesLabel: 'Notes',
      interactionType: 'Type',
      interactionTitle: 'Title',
      interactionNotes: 'Notes (optional)',
      interactionDate: 'Date',
      interactionFollowUp: 'Follow-up date (optional)',
      addInteractionTitle: 'Log Interaction',
      addInteractionDesc: 'Record a call, meeting, email or discussion with this client.',
      saveInteraction: 'Save interaction',
      deleteInteraction: 'Delete',
      deleteInteractionTitle: 'Delete interaction?',
      deleteInteractionDesc: 'This will permanently remove this interaction.',
      interactionDeleteFailed: 'Failed to delete interaction',
      interactionDeleted: 'Interaction deleted',
      interactionAddFailed: 'Failed to log interaction',
      interactionAdded: 'Interaction logged',
      call: 'Call',
      meeting: 'Meeting',
      emailType: 'Email',
      discussion: 'Discussion',
      dropHere: 'Drop files here or click to browse',
      uploading: 'Uploading...',
      attachmentDeleteTitle: 'Delete file?',
      attachmentDeleteDesc: 'This will permanently remove this file.',
      attachmentDeleted: 'File deleted',
      attachmentDeleteFailed: 'Failed to delete file',
      attachmentUploadFailed: 'Failed to upload file',
      attachmentUploaded: 'File uploaded',
      download: 'Download',
      open: 'Open',
      view: 'View',
      send: 'Send',
      followUpLabel: 'Follow-up',
      quotesTab: 'Quotes',
      allNotes: 'All Notes',
      allInteractions: 'All Interactions',
      interactionTitleRequired: 'Title is required',
      noQuotes: 'No quotes yet for this client.',
      noBillingDetails: 'No billing details set.',
      addBillingNow: 'Add now',
      noteBadge: 'Note',
      quoteBadge: 'Quote',
    },
    fr: {
      shellTitle: 'Client',
      notFound: 'Client introuvable.',
      loadFailed: 'Impossible de charger les d\u00e9tails du client',
      updateFailed: 'Impossible de mettre \u00e0 jour le client',
      updated: 'Client mis \u00e0 jour',
      deleteFailed: 'Impossible de supprimer le client',
      deleted: 'Client supprim\u00e9',
      noteValidation: 'Le titre et la description sont requis',
      noteAddFailed: "Impossible d'ajouter la note",
      noteAdded: 'Note ajout\u00e9e',
      noteUpdateFailed: 'Impossible de mettre \u00e0 jour la note',
      noteUpdated: 'Note mise \u00e0 jour',
      profile: 'Profil',
      billing: 'Facturation',
      timeline: 'Chronologie',
      notes: 'Notes & T\u00e2ches',
      interactions: 'Interactions',
      attachments: 'Pi\u00e8ces jointes',
      createQuote: 'Cr\u00e9er un devis',
      createInvoice: 'Cr\u00e9er une facture',
      addNote: 'Ajouter une note',
      addInteraction: 'Enregistrer interaction',
      uploadFile: 'T\u00e9l\u00e9charger fichier',
      edit: 'Modifier',
      delete: 'Supprimer',
      cancel: 'Annuler',
      saving: 'Enregistrement...',
      saveChanges: 'Enregistrer',
      deleteTitle: 'Supprimer le client\u00a0?',
      deleteDesc: 'Cette action supprimera d\u00e9finitivement ce client et ses notes li\u00e9es.',
      deleting: 'Suppression...',
      deleteClient: 'Supprimer le client',
      editClient: 'Modifier le client',
      editClientDesc: 'Mettez \u00e0 jour les champs principaux du profil.',
      clientType: 'Type de client',
      companyType: 'Entreprise',
      individualType: 'Particulier',
      titleLabel: 'Civilit\u00e9',
      firstName: 'Pr\u00e9nom',
      lastName: 'Nom',
      companyNameLabel: "Nom de l'entreprise",
      vatNumber: 'Num\u00e9ro TVA',
      rcsNumber: 'Num\u00e9ro RCS',
      businessAuthorizationNumber: 'Num\u00e9ro autorisation commerciale',
      matriculeNumber: 'Matricule',
      street: 'Rue',
      postalCode: 'Code postal',
      city: 'Ville',
      country: 'Pays',
      bankName: 'Nom de la banque',
      iban: 'IBAN',
      responsibleEmail: 'E-mail responsable',
      companyPhone: 'T\u00e9l\u00e9phone entreprise',
      privatePhone: 'T\u00e9l\u00e9phone priv\u00e9',
      mobilePhone: 'T\u00e9l\u00e9phone mobile',
      additionalDescription: 'Description compl\u00e9mentaire',
      name: 'Nom',
      email: 'E-mail',
      phone: 'T\u00e9l\u00e9phone',
      address: 'Adresse',
      company: 'Entreprise',
      vatTax: 'TVA / ID fiscal',
      billingEmail: 'E-mail de facturation',
      billingAddress: 'Adresse de facturation',
      sameAsMain: 'Identique au principal',
      addNoteTitle: 'Ajouter une note / t\u00e2che',
      addNoteDesc: 'Cette note est automatiquement li\u00e9e \u00e0 ce client.',
      title: 'Titre',
      description: 'Description',
      followUpDate: 'Date de suivi',
      saveNote: 'Enregistrer la note',
      editNote: 'Modifier la note',
      editNoteDesc: 'Mettez \u00e0 jour cette note client.',
      noTimeline: 'Aucune activit\u00e9. Cr\u00e9ez un devis, ajoutez une note ou enregistrez une interaction.',
      noNotes: 'Aucune note. Ajoutez une note pour suivre les t\u00e2ches et relances.',
      noInteractions: 'Aucune interaction. Enregistrez un appel, une r\u00e9union, un e-mail ou une discussion.',
      noAttachments: 'Aucune pi\u00e8ce jointe. D\u00e9posez des contrats, PDF ou autres fichiers.',
      pendingTasks: 'T\u00e2ches en attente et \u00e0 venir',
      overdue: 'En retard',
      upcoming: '\u00c0 venir',
      totalRevenue: 'Revenu (accept\u00e9)',
      totalQuotes: 'Devis',
      notesLabel: 'Notes',
      interactionType: 'Type',
      interactionTitle: 'Titre',
      interactionNotes: 'Notes (optionnel)',
      interactionDate: 'Date',
      interactionFollowUp: 'Date de suivi (optionnel)',
      addInteractionTitle: 'Enregistrer une interaction',
      addInteractionDesc: "Enregistrez un appel, une r\u00e9union, un e-mail ou une discussion.",
      saveInteraction: 'Enregistrer',
      deleteInteraction: 'Supprimer',
      deleteInteractionTitle: "Supprimer l'interaction\u00a0?",
      deleteInteractionDesc: "Cette action supprimera d\u00e9finitivement cette interaction.",
      interactionDeleteFailed: "Impossible de supprimer l'interaction",
      interactionDeleted: 'Interaction supprim\u00e9e',
      interactionAddFailed: "Impossible d'enregistrer l'interaction",
      interactionAdded: 'Interaction enregistr\u00e9e',
      call: 'Appel',
      meeting: 'R\u00e9union',
      emailType: 'E-mail',
      discussion: 'Discussion',
      dropHere: 'D\u00e9posez les fichiers ici ou cliquez pour parcourir',
      uploading: 'T\u00e9l\u00e9chargement...',
      attachmentDeleteTitle: 'Supprimer le fichier\u00a0?',
      attachmentDeleteDesc: 'Cette action supprimera d\u00e9finitivement ce fichier.',
      attachmentDeleted: 'Fichier supprim\u00e9',
      attachmentDeleteFailed: 'Impossible de supprimer le fichier',
      attachmentUploadFailed: 'Impossible de t\u00e9l\u00e9charger le fichier',
      attachmentUploaded: 'Fichier t\u00e9l\u00e9charg\u00e9',
      download: 'T\u00e9l\u00e9charger',
      open: 'Ouvrir',
      view: 'Voir',
      send: 'Envoyer',
      followUpLabel: 'Suivi',
      quotesTab: 'Devis',
      allNotes: 'Toutes les notes',
      allInteractions: 'Toutes les interactions',
      interactionTitleRequired: 'Le titre est requis',
      noQuotes: 'Aucun devis pour ce client.',
      noBillingDetails: 'Aucun d\u00e9tail de facturation.',
      addBillingNow: 'Ajouter',
      noteBadge: 'Note',
      quoteBadge: 'Devis',
    },
  }[locale];


  const [clientId, setClientId] = useState('');
  const [client, setClient] = useState<ClientRecord | null>(null);
  const [timeline, setTimeline] = useState<NoteItem[]>([]);
  const [quotes, setQuotes] = useState<ClientQuote[]>([]);
  const [interactions, setInteractions] = useState<InteractionItem[]>([]);
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isNoteOpen, setIsNoteOpen] = useState(false);
  const [isNoteEditOpen, setIsNoteEditOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isInteractionOpen, setIsInteractionOpen] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingClient, setIsDeletingClient] = useState(false);
  const [isNoteUpdating, setIsNoteUpdating] = useState(false);
  const [isAddingInteraction, setIsAddingInteraction] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const [deletingInteractionId, setDeletingInteractionId] = useState<string | null>(null);
  const [deletingAttachmentId, setDeletingAttachmentId] = useState<string | null>(null);
  const [sendTarget, setSendTarget] = useState<ClientQuote | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [activeTab, setActiveTab] = useState('timeline');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [noteForm, setNoteForm] = useState({ title: '', description: '', followUpDate: '' });
  const [editNoteForm, setEditNoteForm] = useState({ title: '', description: '', followUpDate: '' });
  const [interactionForm, setInteractionForm] = useState<{
    type: InteractionType;
    title: string;
    notes: string;
    date: string;
    followUpDate: string;
  }>({ type: 'call', title: '', notes: '', date: new Date().toISOString().slice(0, 10), followUpDate: '' });

  // ─── Data loading ─────────────────────────────────────────────────────────────

  useEffect(() => {
    params.then((resolved) => setClientId(resolved.id));
  }, [params]);

  const loadDetails = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/clients/${clientId}`, { cache: 'no-store' });
      const data = (await response.json()) as DetailResponse;
      if (!response.ok || !data.success || !data.data) {
        throw new Error(data.message || t.loadFailed);
      }
      const { client: c, timeline: tl, interactions: ints, attachments: atts } = data.data;
      setClient(c);
      setTimeline(tl);
      setInteractions(ints);
      setAttachments(atts);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.loadFailed);
      setClient(null);
    } finally {
      setLoading(false);
    }
  }, [clientId, t.loadFailed]);

  const loadQuotes = useCallback(async () => {
    if (!clientId) return;
    setQuotesLoading(true);
    try {
      const res = await fetch(`/api/quotes?clientId=${clientId}&limit=100`, { cache: 'no-store' });
      const data = (await res.json()) as { success?: boolean; data?: ClientQuote[] };
      setQuotes(data.data ?? []);
    } catch {
      setQuotes([]);
    } finally {
      setQuotesLoading(false);
    }
  }, [clientId]);

  const refreshAttachments = useCallback(async () => {
    if (!clientId) return;
    try {
      const res = await fetch(`/api/clients/${clientId}/attachments`, { cache: 'no-store' });
      const data = (await res.json()) as { success: boolean; data?: AttachmentItem[] };
      if (data.success) setAttachments(data.data ?? []);
    } catch { /* silent background refresh */ }
  }, [clientId]);

  useEffect(() => { loadDetails(); }, [loadDetails]);
  useEffect(() => { loadQuotes(); }, [loadQuotes]);


  const totalRevenue = useMemo(
    () => quotes.reduce((sum, q) => (q.status === 'accepted' ? sum + q.totalIncludingTax : sum), 0),
    [quotes],
  );

  const today = useMemo(() => new Date(), []);

  const pendingNotes = useMemo(
    () => timeline.filter((n) => n.followUpDate).sort((a, b) => new Date(a.followUpDate!).getTime() - new Date(b.followUpDate!).getTime()),
    [timeline],
  );

  const overdueNotes = useMemo(() => pendingNotes.filter((n) => new Date(n.followUpDate!) < today), [pendingNotes, today]);
  const upcomingNotes = useMemo(() => pendingNotes.filter((n) => new Date(n.followUpDate!) >= today), [pendingNotes, today]);

  type TimelineEvent =
    | { kind: 'note'; date: Date; item: NoteItem }
    | { kind: 'quote'; date: Date; item: ClientQuote }
    | { kind: 'interaction'; date: Date; item: InteractionItem };

  const unifiedTimeline = useMemo<TimelineEvent[]>(() => {
    const noteEvents: TimelineEvent[] = timeline.map((n) => ({ kind: 'note', date: new Date(n.createdAt), item: n }));
    const quoteEvents: TimelineEvent[] = quotes.map((q) => ({ kind: 'quote', date: new Date(q.statusChangedAt ?? q.date), item: q }));
    const interactionEvents: TimelineEvent[] = interactions.map((i) => ({ kind: 'interaction', date: new Date(i.date), item: i }));
    return [...noteEvents, ...quoteEvents, ...interactionEvents].sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [timeline, quotes, interactions]);

  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    [locale],
  );
  async function removeClient() {
    if (!client) return;
    setIsDeletingClient(true);
    try {
      const res = await fetch(`/api/clients/${client._id}`, { method: 'DELETE' });
      const data = (await res.json()) as { success: boolean; message?: string };
      if (!res.ok || !data.success) throw new Error(data.message || t.deleteFailed);
      toast.success(t.deleted);
      router.push('/clients');
    } catch (err) {
      toast.error(resolveTranslatedError(locale, err, t.deleteFailed));
    } finally {
      setIsDeletingClient(false);
      setIsDeleteConfirmOpen(false);
    }
  }

  async function addNote() {
    if (!client) return;
    if (!noteForm.title.trim() || !noteForm.description.trim()) { toast.error(t.noteValidation); return; }
    setIsSaving(true);
    try {
      const res = await fetch(`/api/clients/${client._id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: noteForm.title, description: noteForm.description, followUpDate: noteForm.followUpDate || null }),
      });
      const data = (await res.json()) as { success: boolean; message?: string };
      if (!res.ok || !data.success) throw new Error(data.message || t.noteAddFailed);
      toast.success(t.noteAdded);
      setIsNoteOpen(false);
      setNoteForm({ title: '', description: '', followUpDate: '' });
      await loadDetails();
    } catch (err) {
      toast.error(resolveTranslatedError(locale, err, t.noteAddFailed));
    } finally {
      setIsSaving(false);
    }
  }

  function openNoteEdit(note: NoteItem) {
    setEditingNoteId(note._id);
    setEditNoteForm({ title: note.title, description: note.description, followUpDate: note.followUpDate ? String(note.followUpDate).slice(0, 10) : '' });
    setIsNoteEditOpen(true);
  }

  async function updateNote() {
    if (!editingNoteId) return;
    if (!editNoteForm.title.trim() || !editNoteForm.description.trim()) { toast.error(t.noteValidation); return; }
    setIsNoteUpdating(true);
    try {
      const res = await fetch(`/api/notes/${editingNoteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editNoteForm.title, description: editNoteForm.description, followUpDate: editNoteForm.followUpDate || null }),
      });
      const data = (await res.json()) as { success: boolean; message?: string };
      if (!res.ok || !data.success) throw new Error(data.message || t.noteUpdateFailed);
      toast.success(t.noteUpdated);
      setIsNoteEditOpen(false);
      setEditingNoteId(null);
      await loadDetails();
    } catch (err) {
      toast.error(resolveTranslatedError(locale, err, t.noteUpdateFailed));
    } finally {
      setIsNoteUpdating(false);
    }
  }

  async function addInteraction() {
    if (!client) return;
    if (!interactionForm.title.trim()) { toast.error(t.interactionTitleRequired); return; }
    setIsAddingInteraction(true);
    try {
      const res = await fetch(`/api/clients/${client._id}/interactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: interactionForm.type, title: interactionForm.title, notes: interactionForm.notes || null, date: interactionForm.date, followUpDate: interactionForm.followUpDate || null }),
      });
      const data = (await res.json()) as { success: boolean; message?: string };
      if (!res.ok || !data.success) throw new Error(data.message || t.interactionAddFailed);
      toast.success(t.interactionAdded);
      setIsInteractionOpen(false);
      setInteractionForm({ type: 'call', title: '', notes: '', date: new Date().toISOString().slice(0, 10), followUpDate: '' });
      await loadDetails();
    } catch (err) {
      toast.error(resolveTranslatedError(locale, err, t.interactionAddFailed));
    } finally {
      setIsAddingInteraction(false);
    }
  }

  async function confirmDeleteInteraction() {
    if (!deletingInteractionId) return;
    try {
      const res = await fetch(`/api/clients/${clientId}/interactions/${deletingInteractionId}`, { method: 'DELETE' });
      const data = (await res.json()) as { success: boolean; message?: string };
      if (!res.ok || !data.success) throw new Error(data.message || t.interactionDeleteFailed);
      toast.success(t.interactionDeleted);
      await loadDetails();
    } catch (err) {
      toast.error(resolveTranslatedError(locale, err, t.interactionDeleteFailed));
    } finally {
      setDeletingInteractionId(null);
    }
  }

  async function confirmDeleteAttachment() {
    if (!deletingAttachmentId) return;
    try {
      const res = await fetch(`/api/clients/${clientId}/attachments/${deletingAttachmentId}`, { method: 'DELETE' });
      const data = (await res.json()) as { success: boolean; message?: string };
      if (!res.ok || !data.success) throw new Error(data.message || t.attachmentDeleteFailed);
      toast.success(t.attachmentDeleted);
      await loadDetails();
    } catch (err) {
      toast.error(resolveTranslatedError(locale, err, t.attachmentDeleteFailed));
    } finally {
      setDeletingAttachmentId(null);
    }
  }

  async function uploadFile(file: File) {
    setIsUploading(true);
    try {
      const presignRes = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, fileType: file.type, folder: `clients/${clientId}` }),
      });
      const presignData = (await presignRes.json()) as { success: boolean; uploadUrl?: string; fileUrl?: string; key?: string; message?: string };
      if (!presignRes.ok || !presignData.success || !presignData.uploadUrl || !presignData.fileUrl) throw new Error(presignData.message || t.attachmentUploadFailed);

      const uploadRes = await fetch(presignData.uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
      if (!uploadRes.ok) throw new Error(t.attachmentUploadFailed);

      const saveRes = await fetch(`/api/clients/${clientId}/attachments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, fileUrl: presignData.fileUrl, fileType: file.type, fileSize: file.size, s3Key: presignData.key }),
      });
      const saveData = (await saveRes.json()) as { success: boolean; message?: string };
      if (!saveRes.ok || !saveData.success) throw new Error(saveData.message || t.attachmentUploadFailed);

      toast.success(t.attachmentUploaded);
      setActiveTab('attachments');
      await refreshAttachments();
    } catch (err) {
      toast.error(resolveTranslatedError(locale, err, t.attachmentUploadFailed));
    } finally {
      setIsUploading(false);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void uploadFile(file);
    e.target.value = '';
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void uploadFile(file);
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <CrmShell title={t.shellTitle}>
        {error ? <ErrorMessage message={error} /> : null}

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-14 w-full" />
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[320px_1fr]">
              <div className="space-y-4">
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
              <Skeleton className="h-125 w-full" />
            </div>
          </div>
        ) : !client ? (
          <EmptyState message={t.notFound} />
        ) : (
          <div className="space-y-4">

            {/* ── Hero / Quick Action Bar ───────────────────────────────── */}
            <div className={`overflow-hidden rounded-xl border border-border/60 shadow-sm ${
              client.clientType === 'individual'
                ? 'bg-linear-to-br from-emerald-50 via-card to-card dark:from-emerald-950/25 dark:via-card dark:to-card'
                : 'bg-linear-to-br from-indigo-50 via-card to-card dark:from-indigo-950/25 dark:via-card dark:to-card'
            }`}>
              <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
                {/* Identity */}
                <div className="flex min-w-0 items-center gap-4">
                  <div className={`flex size-14 shrink-0 items-center justify-center rounded-2xl text-xl font-bold text-white shadow-md ${client.clientType === 'individual' ? 'bg-emerald-500' : 'bg-indigo-500'}`}>
                    {client.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="text-xl font-bold text-foreground">{client.fullName}</h1>
                      {/* Client type badge */}
                      <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        client.clientType === 'individual'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                          : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
                      }`}>
                        {client.clientType === 'individual'
                          ? <><UserIcon className="size-2.5" />{t.individualType}</>
                          : <><Building2Icon className="size-2.5" />{t.companyType}</>}
                      </span>
                    </div>
                    {client.companyName ? <p className="text-sm text-muted-foreground">{client.companyName}</p> : null}
                    {(client.responsibleEmail || client.email) ? (
                      <p className="mt-0.5 text-xs text-muted-foreground/70">{client.responsibleEmail || client.email}</p>
                    ) : null}
                  </div>
                </div>
                {/* Action buttons – horizontally scrollable on small screens */}
                <div data-tour-client-actions className="-mx-5 flex items-center gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:px-0 sm:pb-0">
                  <Button size="sm" asChild className="shrink-0">
                    <Link href={`/quotes/new?clientId=${clientId}`}>
                      <FilePlusIcon className="size-3.5" />{t.createQuote}
                    </Link>
                  </Button>
                  <Button size="sm" variant="outline" asChild className="shrink-0">
                    <Link href={`/invoices/new?clientId=${clientId}`}>
                      <ReceiptIcon className="size-3.5" />{t.createInvoice}
                    </Link>
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setIsNoteOpen(true)} className="shrink-0">
                    <StickyNoteIcon className="size-3.5" />{t.addNote}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setIsInteractionOpen(true)} className="shrink-0">
                    <PhoneCallIcon className="size-3.5" />{t.addInteraction}
                  </Button>
                </div>
              </div>
            </div>

            {/* ── Overdue tasks alert ───────────────────────────────────── */}
            {overdueNotes.length > 0 ? (
              <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50/70 px-4 py-3 dark:border-red-900/40 dark:bg-red-950/20">
                <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-red-500" />
                <p className="text-sm">
                  <span className="font-semibold text-red-700 dark:text-red-400">{overdueNotes.length} {t.overdue}</span>
                  <span className="ml-1 text-red-600/80 dark:text-red-400/70">
                    — {overdueNotes.slice(0, 2).map((n) => n.title).join(', ')}
                    {overdueNotes.length > 2 ? ` +${overdueNotes.length - 2}` : ''}
                  </span>
                </p>
              </div>
            ) : null}

            {/* ── Content grid ─────────────────────────────────────────── */}
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[300px_1fr]">

              {/* ── Left sidebar ─────────────────────────────────────────── */}
              <div className="space-y-4">

                {/* Profile */}
                <Card data-tour-client-profile-card>
                  <CardHeader className="border-b pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="text-base">{t.profile}</CardTitle>
                        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          client.clientType === 'individual'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                            : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
                        }`}>
                          {client.clientType === 'individual'
                            ? <><UserIcon className="size-2.5" />{t.individualType}</>
                            : <><Building2Icon className="size-2.5" />{t.companyType}</>}
                        </span>
                      </div>
                      <div className="flex gap-1.5">
                        <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setIsEditOpen(true)}>
                          <PencilIcon className="size-3" />{t.edit}
                        </Button>
                        <Button variant="destructive" size="sm" className="h-7 px-2 text-xs" onClick={() => setIsDeleteConfirmOpen(true)}>
                          <Trash2Icon className="size-3" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-2 text-sm">
                    {client.clientType === 'individual' ? (
                      <>
                        <InfoRow label={t.titleLabel} value={client.title} />
                        <InfoRow label={t.firstName} value={client.firstName} />
                        <InfoRow label={t.lastName} value={client.lastName} />
                        <InfoRow label={t.responsibleEmail} value={client.responsibleEmail || client.email} />
                        <InfoRow label={t.privatePhone} value={client.privatePhone || client.phone} />
                        <InfoRow label={t.mobilePhone} value={client.mobilePhone} />
                      </>
                    ) : (
                      <>
                        <InfoRow label={t.companyNameLabel} value={client.companyName} />
                        <InfoRow label={t.vatNumber} value={client.vatNumber} />
                        <InfoRow label={t.rcsNumber} value={client.rcsNumber} />
                        <InfoRow label={t.responsibleEmail} value={client.responsibleEmail || client.email} />
                        <InfoRow label={t.companyPhone} value={client.companyPhone || client.phone} />
                        <InfoRow label={t.mobilePhone} value={client.mobilePhone} />
                      </>
                    )}
                    <InfoRow label={t.address} value={client.address} />
                  </CardContent>
                </Card>

                {/* Billing */}
                <Card data-tour-client-billing-card>
                  <CardHeader className="border-b pb-3">
                    <CardTitle className="text-base">{t.billing}</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-2 text-sm">
                    <InfoRow label={t.billingEmail} value={client.billingEmail} />
                    <InfoRow label={t.billingAddress} value={client.billingAddress} />
                    {!client.billingEmail && !client.billingAddress ? (
                      <p className="text-xs italic text-muted-foreground/60">
                        {t.noBillingDetails}{' '}
                        <button type="button" className="text-primary hover:underline" onClick={() => setIsEditOpen(true)}>{t.addBillingNow}</button>
                      </p>
                    ) : null}
                  </CardContent>
                </Card>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="flex flex-col items-center gap-1 rounded-xl border border-border/40 bg-primary/5 p-3 text-center dark:bg-primary/10">
                    <FileTextIcon className="size-5 text-primary/70" />
                    <p className="text-[11px] text-muted-foreground">{t.totalQuotes}</p>
                    <p className="text-base font-bold">{quotes.length}</p>
                  </div>
                  <div className="flex flex-col items-center gap-1 rounded-xl border border-emerald-200/60 bg-emerald-50/60 p-3 text-center dark:border-emerald-900/30 dark:bg-emerald-950/20">
                    <TrendingUpIcon className="size-5 text-emerald-500" />
                    <p className="text-[11px] text-muted-foreground">{t.totalRevenue}</p>
                    <PriceDisplay cents={totalRevenue} locale={locale === 'fr' ? 'fr-FR' : 'en-GB'} className="text-sm font-bold text-emerald-700 dark:text-emerald-400" />
                  </div>
                  <div className="flex flex-col items-center gap-1 rounded-xl border border-amber-200/60 bg-amber-50/60 p-3 text-center dark:border-amber-900/30 dark:bg-amber-950/20">
                    <ClipboardListIcon className="size-5 text-amber-500" />
                    <p className="text-[11px] text-muted-foreground">{t.notesLabel}</p>
                    <p className="text-base font-bold">{timeline.length}</p>
                  </div>
                </div>
              </div>

              {/* ── Tabs ─────────────────────────────────────────────────── */}
              <Tabs value={activeTab} onValueChange={setActiveTab} className="min-w-0" data-tour-client-tabs>
                <div className="mb-4 overflow-x-auto">
                  <TabsList variant="line" className="w-full justify-start gap-0 rounded-none border-b border-border/60 bg-transparent p-0 h-auto">
                    <TabTriggerStyled value="timeline">{t.timeline}</TabTriggerStyled>
                    <TabTriggerStyled value="notes" badge={pendingNotes.length > 0 ? pendingNotes.length : undefined}>{t.notes}</TabTriggerStyled>
                    <TabTriggerStyled value="interactions" badge={interactions.length > 0 ? interactions.length : undefined}>{t.interactions}</TabTriggerStyled>
                    <TabTriggerStyled value="quotes" badge={quotes.length > 0 ? quotes.length : undefined}>{t.quotesTab}</TabTriggerStyled>
                    <TabTriggerStyled value="attachments" badge={attachments.length > 0 ? attachments.length : undefined}>{t.attachments}</TabTriggerStyled>
                  </TabsList>
                </div>

                {/* TIMELINE */}
                <TabsContent value="timeline">
                  {unifiedTimeline.length === 0 ? (
                    <EmptyState message={t.noTimeline} />
                  ) : (
                    <ol className="relative ml-2 space-y-0 border-l border-border/50">
                      {unifiedTimeline.map((event) => {
                        if (event.kind === 'note') {
                          return (
                            <TimelineNoteItem
                              key={`note-${event.item._id}`}
                              note={event.item}
                              dateFormatter={dateFormatter}
                              onEdit={() => openNoteEdit(event.item)}
                              noteBadge={t.noteBadge}
                              followUpLabel={t.followUpLabel}
                            />
                          );
                        }
                        if (event.kind === 'interaction') {
                          return (
                            <TimelineInteractionItem
                              key={`int-${event.item._id}`}
                              interaction={event.item}
                              dateFormatter={dateFormatter}
                              onDelete={() => setDeletingInteractionId(event.item._id)}
                              typeLabels={{ call: t.call, meeting: t.meeting, email: t.emailType, discussion: t.discussion }}
                              followUpLabel={t.followUpLabel}
                            />
                          );
                        }
                        return (
                          <TimelineQuoteItem
                            key={`quote-${event.item._id}`}
                            quote={event.item}
                            locale={locale as 'en' | 'fr'}
                            dateFormatter={dateFormatter}
                            onSend={() => setSendTarget(event.item)}
                            quoteBadge={t.quoteBadge}
                          />
                        );
                      })}
                    </ol>
                  )}
                </TabsContent>

                {/* NOTES & TASKS */}
                <TabsContent value="notes" className="space-y-4">
                  {pendingNotes.length > 0 ? (
                    <Card className="border-amber-200/70 bg-amber-50/40 dark:border-amber-900/30 dark:bg-amber-950/10">
                      <CardHeader className="border-b border-amber-200/50 pb-2.5 dark:border-amber-900/30">
                        <div className="flex items-center gap-2">
                          <CalendarClockIcon className="size-4 text-amber-600 dark:text-amber-400" />
                          <CardTitle className="text-sm text-amber-800 dark:text-amber-300">{t.pendingTasks}</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2 pt-3">
                        {overdueNotes.map((note) => (
                          <PendingTaskRow key={note._id} note={note} status="overdue" overdueLabel={t.overdue} upcomingLabel={t.upcoming} locale={locale} onEdit={() => openNoteEdit(note)} />
                        ))}
                        {upcomingNotes.map((note) => (
                          <PendingTaskRow key={note._id} note={note} status="upcoming" overdueLabel={t.overdue} upcomingLabel={t.upcoming} locale={locale} onEdit={() => openNoteEdit(note)} />
                        ))}
                      </CardContent>
                    </Card>
                  ) : null}

                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-muted-foreground">{t.allNotes}</p>
                    <Button size="sm" variant="outline" onClick={() => setIsNoteOpen(true)}>
                      <PlusIcon className="size-3.5" />{t.addNote}
                    </Button>
                  </div>
                  {timeline.length === 0 ? (
                    <EmptyState message={t.noNotes} />
                  ) : (
                    <div className="space-y-3">
                      {[...timeline]
                        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                        .map((note) => (
                          <NoteCard key={note._id} note={note} dateFormatter={dateFormatter} onEdit={() => openNoteEdit(note)} followUpLabel={t.followUpLabel} />
                        ))}
                    </div>
                  )}
                </TabsContent>

                {/* INTERACTIONS */}
                <TabsContent value="interactions" className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-muted-foreground">{t.allInteractions}</p>
                    <Button size="sm" variant="outline" onClick={() => setIsInteractionOpen(true)}>
                      <PlusIcon className="size-3.5" />{t.addInteraction}
                    </Button>
                  </div>
                  {interactions.length === 0 ? (
                    <EmptyState message={t.noInteractions} />
                  ) : (
                    <div className="space-y-3">
                      {[...interactions]
                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                        .map((interaction) => (
                          <InteractionCard
                            key={interaction._id}
                            interaction={interaction}
                            dateFormatter={dateFormatter}
                            onDelete={() => setDeletingInteractionId(interaction._id)}
                            typeLabels={{ call: t.call, meeting: t.meeting, email: t.emailType, discussion: t.discussion }}
                            followUpLabel={t.followUpLabel}
                          />
                        ))}
                    </div>
                  )}
                </TabsContent>

                {/* QUOTES */}
                <TabsContent value="quotes">
                  {quotesLoading ? (
                    <div className="space-y-3">{[1,2,3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
                  ) : quotes.length === 0 ? (
                    <EmptyState message={t.noQuotes} />
                  ) : (
                    <div className="space-y-3">
                      {[...quotes]
                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                        .map((q) => {
                          const bg =
                            q.status === 'accepted' ? 'bg-green-50/70 dark:bg-green-950/15' :
                            q.status === 'refused' || q.status === 'rejected' ? 'bg-red-50/70 dark:bg-red-950/15' :
                            q.status === 'sent' ? 'bg-blue-50/70 dark:bg-blue-950/15' :
                            '';
                          return (
                            <article key={q._id} className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 p-4 shadow-sm ${bg}`}>
                              <div>
                                <p className="text-sm font-semibold">{q.quoteNumber}</p>
                                <p className="text-xs text-muted-foreground">{dateFormatter.format(new Date(q.date))}</p>
                              </div>
                              <QuoteStatusSummary status={q.status} statusChangedAt={q.statusChangedAt} locale={locale as 'en' | 'fr'} />
                              <PriceDisplay cents={q.totalIncludingTax} locale={locale === 'fr' ? 'fr-FR' : 'en-GB'} className="text-sm font-semibold" />
                              <div className="flex items-center gap-2">
                                <Button variant="outline" size="sm" asChild>
                                  <Link href={`/quotes/${q._id}`}><EyeIcon className="size-3.5" />{t.view}</Link>
                                </Button>
                                {q.status === 'draft' ? (
                                  <Button size="sm" onClick={() => setSendTarget(q)}><SendIcon className="size-3.5" />{t.send}</Button>
                                ) : null}
                              </div>
                            </article>
                          );
                        })}
                    </div>
                  )}
                </TabsContent>

                {/* ATTACHMENTS */}
                <TabsContent value="attachments" className="space-y-4">
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 transition-colors ${
                      isDragging ? 'border-primary bg-primary/5' : 'border-border/60 hover:border-primary/50 hover:bg-secondary/40'
                    }`}
                  >
                    <UploadCloudIcon className={`size-8 ${isUploading ? 'animate-pulse text-primary' : 'text-muted-foreground/60'}`} />
                    <p className="text-sm text-muted-foreground">{isUploading ? t.uploading : t.dropHere}</p>
                    <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} disabled={isUploading} />
                  </div>

                  {attachments.length === 0 ? (
                    <EmptyState message={t.noAttachments} />
                  ) : (
                    <div className="space-y-2">
                      {attachments.map((att) => (
                        <AttachmentRow key={att._id} attachment={att} dateFormatter={dateFormatter} onDelete={() => setDeletingAttachmentId(att._id)} downloadLabel={t.download} openLabel={t.open} />
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </div>
        )}
      </CrmShell>

      {isEditOpen && client ? (
        <AddClientModal
          mode="edit"
          clientId={client._id}
          initialData={{
            clientType: client.clientType,
            title: client.title,
            firstName: client.firstName,
            lastName: client.lastName,
            companyName: client.companyName,
            vatNumber: client.vatNumber,
            rcsNumber: client.rcsNumber,
            businessAuthorizationNumber: client.businessAuthorizationNumber,
            matriculeNumber: client.matriculeNumber,
            bankName: client.bankName,
            iban: client.iban,
            responsibleEmail: client.responsibleEmail,
            billingEmail: client.billingEmail,
            companyPhone: client.companyPhone,
            privatePhone: client.privatePhone,
            mobilePhone: client.mobilePhone,
            additionalDescription: client.additionalDescription,
            billingAddress: client.billingAddress,
            addressDetails: client.addressDetails,
          }}
          onClose={() => setIsEditOpen(false)}
          onUpdated={(updatedClient) => {
            setClient(updatedClient as ClientRecord);
          }}
          onSuccess={async () => {
            setIsEditOpen(false);
            await loadDetails();
          }}
        />
      ) : null}

      {/* ── Add Note Sheet ───────────────────────────────────────────────── */}
      <Sheet open={isNoteOpen} onOpenChange={setIsNoteOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{t.addNoteTitle}</SheetTitle>
            <SheetDescription>{t.addNoteDesc}</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            <div className="space-y-3">
              <div className="space-y-1.5"><Label>{t.title}</Label><Input value={noteForm.title} onChange={(e) => setNoteForm((p) => ({ ...p, title: e.target.value }))} /></div>
              <div className="space-y-1.5">
                <Label>{t.description}</Label>
                <textarea className="min-h-28 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" value={noteForm.description} onChange={(e) => setNoteForm((p) => ({ ...p, description: e.target.value }))} />
              </div>
              <div className="space-y-1.5"><Label>{t.followUpDate}</Label><Input type="date" value={noteForm.followUpDate} onChange={(e) => setNoteForm((p) => ({ ...p, followUpDate: e.target.value }))} /></div>
            </div>
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setIsNoteOpen(false)}>{t.cancel}</Button>
            <Button onClick={addNote} disabled={isSaving}>{isSaving ? t.saving : t.saveNote}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ── Edit Note Sheet ──────────────────────────────────────────────── */}
      <Sheet open={isNoteEditOpen} onOpenChange={(open) => { setIsNoteEditOpen(open); if (!open) setEditingNoteId(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{t.editNote}</SheetTitle>
            <SheetDescription>{t.editNoteDesc}</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            <div className="space-y-3">
              <div className="space-y-1.5"><Label>{t.title}</Label><Input value={editNoteForm.title} onChange={(e) => setEditNoteForm((p) => ({ ...p, title: e.target.value }))} /></div>
              <div className="space-y-1.5">
                <Label>{t.description}</Label>
                <textarea className="min-h-28 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" value={editNoteForm.description} onChange={(e) => setEditNoteForm((p) => ({ ...p, description: e.target.value }))} />
              </div>
              <div className="space-y-1.5"><Label>{t.followUpDate}</Label><Input type="date" value={editNoteForm.followUpDate} onChange={(e) => setEditNoteForm((p) => ({ ...p, followUpDate: e.target.value }))} /></div>
            </div>
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setIsNoteEditOpen(false)}>{t.cancel}</Button>
            <Button onClick={updateNote} disabled={isNoteUpdating}>{isNoteUpdating ? t.saving : t.saveChanges}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ── Add Interaction Sheet ────────────────────────────────────────── */}
      <Sheet open={isInteractionOpen} onOpenChange={setIsInteractionOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{t.addInteractionTitle}</SheetTitle>
            <SheetDescription>{t.addInteractionDesc}</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>{t.interactionType}</Label>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                  {(['call', 'meeting', 'email', 'discussion'] as InteractionType[]).map((type) => (
                    <button key={type} type="button" onClick={() => setInteractionForm((p) => ({ ...p, type }))}
                      className={`flex flex-col items-center gap-1.5 rounded-lg border py-2.5 text-xs font-medium transition-colors ${interactionForm.type === type ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-secondary'}`}>
                      <span className="flex items-center justify-center [&_svg]:size-4">{INTERACTION_ICONS[type]}</span>
                      <span>{type === 'email' ? t.emailType : type === 'call' ? t.call : type === 'meeting' ? t.meeting : t.discussion}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5"><Label>{t.interactionTitle}</Label><Input value={interactionForm.title} onChange={(e) => setInteractionForm((p) => ({ ...p, title: e.target.value }))} /></div>
              <div className="space-y-1.5">
                <Label>{t.interactionNotes}</Label>
                <textarea className="min-h-20 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" value={interactionForm.notes} onChange={(e) => setInteractionForm((p) => ({ ...p, notes: e.target.value }))} />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5"><Label>{t.interactionDate}</Label><Input type="date" value={interactionForm.date} onChange={(e) => setInteractionForm((p) => ({ ...p, date: e.target.value }))} /></div>
                <div className="space-y-1.5"><Label>{t.interactionFollowUp}</Label><Input type="date" value={interactionForm.followUpDate} onChange={(e) => setInteractionForm((p) => ({ ...p, followUpDate: e.target.value }))} /></div>
              </div>
            </div>
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setIsInteractionOpen(false)}>{t.cancel}</Button>
            <Button onClick={addInteraction} disabled={isAddingInteraction}>{isAddingInteraction ? t.saving : t.saveInteraction}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ── Delete Client ────────────────────────────────────────────────── */}
      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.deleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>{t.deleteDesc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild><Button variant="outline">{t.cancel}</Button></AlertDialogCancel>
            <AlertDialogAction asChild onClick={(e) => { e.preventDefault(); if (!isDeletingClient) void removeClient(); }}>
              <Button variant="destructive" disabled={isDeletingClient}>{isDeletingClient ? t.deleting : t.deleteClient}</Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(deletingInteractionId)} onOpenChange={(open) => { if (!open) setDeletingInteractionId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.deleteInteractionTitle}</AlertDialogTitle>
            <AlertDialogDescription>{t.deleteInteractionDesc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild><Button variant="outline">{t.cancel}</Button></AlertDialogCancel>
            <AlertDialogAction asChild onClick={(e) => { e.preventDefault(); void confirmDeleteInteraction(); }}>
              <Button variant="destructive">{t.deleteInteraction}</Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(deletingAttachmentId)} onOpenChange={(open) => { if (!open) setDeletingAttachmentId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.attachmentDeleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>{t.attachmentDeleteDesc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild><Button variant="outline">{t.cancel}</Button></AlertDialogCancel>
            <AlertDialogAction asChild onClick={(e) => { e.preventDefault(); void confirmDeleteAttachment(); }}>
              <Button variant="destructive">{t.delete}</Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {sendTarget ? (
        <SendQuoteModal
          open={Boolean(sendTarget)}
          onOpenChange={(next) => (!next ? setSendTarget(null) : undefined)}
          quoteId={sendTarget._id}
          quoteNumber={sendTarget.quoteNumber}
          clientEmail={client?.email}
          clientName={client?.fullName}
          companyName={client?.companyName}
          quoteStatus={sendTarget.status}
          locale={locale as 'en' | 'fr'}
          onSent={() => { setSendTarget(null); void loadQuotes(); }}
        />
      ) : null}
    </>
  );
}


function TabTriggerStyled({ value, children, badge }: { value: string; children: React.ReactNode; badge?: number }) {
  return (
    <TabsTrigger value={value} className="h-auto flex-none gap-1.5 rounded-none border-0 px-3 pb-2.5 pt-1 text-sm font-medium transition-colors data-[state=inactive]:text-muted-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none dark:data-[state=active]:bg-transparent dark:data-[state=active]:border-0">
      {children}
      {badge != null ? (
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">{badge}</span>
      ) : null}
    </TabsTrigger>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-start gap-3 border-b border-border/30 py-1.5 last:border-0">
      <span className="w-24 shrink-0 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/60">{label}</span>
      <span className="min-w-0 flex-1 wrap-break-word text-sm">{value || <span className="text-muted-foreground/30">—</span>}</span>
    </div>
  );
}

function TimelineNoteItem({ note, dateFormatter, onEdit, noteBadge, followUpLabel }: {
  note: NoteItem; dateFormatter: Intl.DateTimeFormat; onEdit: () => void; noteBadge: string; followUpLabel: string;
}) {
  return (
    <li className="mb-6 ml-4">
      <span className="absolute -left-1.5 mt-1.5 size-3 rounded-full border border-border bg-emerald-400" />
      <div className="rounded-lg border border-l-4 border-border/70 border-l-emerald-400 bg-emerald-50/60 p-4 dark:bg-emerald-950/20">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">{noteBadge}</span>
            <h3 className="text-sm font-semibold">{note.title}</h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{dateFormatter.format(new Date(note.createdAt))}</span>
            <Button type="button" variant="ghost" size="icon-sm" onClick={onEdit}><PencilIcon className="size-3.5" /></Button>
          </div>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{note.description}</p>
        {note.followUpDate ? (
          <p className="mt-2 flex items-center gap-1 text-xs text-sky-600 dark:text-sky-400">
            <ClockIcon className="size-3" />{followUpLabel}: {dateFormatter.format(new Date(note.followUpDate))}
          </p>
        ) : null}
      </div>
    </li>
  );
}

function TimelineInteractionItem({ interaction, dateFormatter, onDelete, typeLabels, followUpLabel }: {
  interaction: InteractionItem; dateFormatter: Intl.DateTimeFormat; onDelete: () => void;
  typeLabels: Record<InteractionType, string>;
  followUpLabel: string;
}) {
  const colorClass = INTERACTION_COLORS[interaction.type];
  const dotClass = INTERACTION_DOT_COLORS[interaction.type];
  return (
    <li className="mb-6 ml-4">
      <span className={`absolute -left-1.5 mt-1.5 size-3 rounded-full border border-border ${dotClass}`} />
      <div className={`rounded-lg border border-l-4 border-border/70 p-4 ${colorClass}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded bg-background/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{INTERACTION_ICONS[interaction.type]} {typeLabels[interaction.type]}</span>
            <h3 className="text-sm font-semibold">{interaction.title}</h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{dateFormatter.format(new Date(interaction.date))}</span>
            <Button type="button" variant="ghost" size="icon-sm" onClick={onDelete}><Trash2Icon className="size-3.5" /></Button>
          </div>
        </div>
        {interaction.notes ? <p className="mt-1 text-sm text-muted-foreground">{interaction.notes}</p> : null}
        {interaction.followUpDate ? (
          <p className="mt-2 flex items-center gap-1 text-xs text-sky-600 dark:text-sky-400">
            <ClockIcon className="size-3" />{followUpLabel}: {dateFormatter.format(new Date(interaction.followUpDate))}
          </p>
        ) : null}
      </div>
    </li>
  );
}

function TimelineQuoteItem({ quote, locale, dateFormatter, onSend, quoteBadge }: {
  quote: ClientQuote; locale: 'en' | 'fr'; dateFormatter: Intl.DateTimeFormat;
  onSend: () => void; quoteBadge: string;
}) {
  const accentColor =
    quote.status === 'accepted' ? 'border-l-green-500' :
    quote.status === 'refused' || quote.status === 'rejected' ? 'border-l-red-400' :
    quote.status === 'sent' ? 'border-l-blue-400' : 'border-l-border';
  const bgColor =
    quote.status === 'accepted' ? 'bg-green-50/80 dark:bg-green-950/20' :
    quote.status === 'refused' || quote.status === 'rejected' ? 'bg-red-50/80 dark:bg-red-950/20' :
    quote.status === 'sent' ? 'bg-blue-50/80 dark:bg-blue-950/20' : 'bg-zinc-50/80 dark:bg-zinc-900/20';
  const dotColor =
    quote.status === 'accepted' ? 'bg-green-500' :
    quote.status === 'refused' || quote.status === 'rejected' ? 'bg-red-400' :
    quote.status === 'sent' ? 'bg-blue-400' : 'bg-muted-foreground/40';
  const isConverted = Boolean(quote.convertedToInvoice && quote.invoiceId);
  return (
    <li className="mb-6 ml-4">
      <span className={`absolute -left-1.5 mt-1.5 size-3 rounded-full border border-border ${dotColor}`} />
      <div className={`rounded-lg border border-l-4 border-border/70 p-4 ${accentColor} ${bgColor}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{quoteBadge}</span>
            <span className="text-sm font-semibold">{quote.quoteNumber}</span>
            {isConverted ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold leading-none text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">
                {locale === 'fr' ? 'Facture creee' : 'Invoiced'}
              </span>
            ) : null}
            <QuoteStatusSummary status={quote.status} statusChangedAt={quote.statusChangedAt} locale={locale} />
          </div>
          <div className="flex items-center gap-2">
            <PriceDisplay cents={quote.totalIncludingTax} locale={locale === 'fr' ? 'fr-FR' : 'en-GB'} className="text-xs font-semibold" />
            {isConverted && quote.invoiceId ? (
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/invoices/${quote.invoiceId}`}>{locale === 'fr' ? 'Facture' : 'Invoice'}</Link>
              </Button>
            ) : null}
            <Button variant="ghost" size="icon-sm" asChild>
              <Link href={`/quotes/${quote._id}`}><EyeIcon className="size-3.5" /></Link>
            </Button>
            {quote.status === 'draft' ? (
              <Button variant="ghost" size="icon-sm" onClick={onSend}><SendIcon className="size-3.5" /></Button>
            ) : null}
          </div>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{dateFormatter.format(new Date(quote.date))}</p>
      </div>
    </li>
  );
}

function NoteCard({ note, dateFormatter, onEdit, followUpLabel }: {
  note: NoteItem; dateFormatter: Intl.DateTimeFormat; onEdit: () => void; followUpLabel: string;
}) {
  const isOverdue = note.followUpDate && new Date(note.followUpDate) < new Date();
  return (
    <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{note.title}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{note.description}</p>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onEdit}><PencilIcon className="size-3.5" /></Button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-[11px] text-muted-foreground">{dateFormatter.format(new Date(note.createdAt))}</span>
        {note.followUpDate ? (
          <span className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ${isOverdue ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' : 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300'}`}>
            {isOverdue ? <AlertTriangleIcon className="size-3" /> : <ClockIcon className="size-3" />}
            {followUpLabel}: {dateFormatter.format(new Date(note.followUpDate))}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function PendingTaskRow({ note, status, overdueLabel, upcomingLabel, locale, onEdit }: {
  note: NoteItem; status: 'overdue' | 'upcoming'; overdueLabel: string; upcomingLabel: string; locale: string; onEdit: () => void;
}) {
  const dateStr = note.followUpDate
    ? new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(note.followUpDate))
    : '';
  return (
    <div className={`flex items-start justify-between gap-3 rounded-lg border p-3 ${status === 'overdue' ? 'border-red-200/60 bg-red-50/40 dark:border-red-900/30 dark:bg-red-950/10' : 'border-sky-200/60 bg-sky-50/40 dark:border-sky-900/30 dark:bg-sky-950/10'}`}>
      <div className="flex items-center gap-2">
        {status === 'overdue' ? <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0 text-red-500" /> : <ClockIcon className="mt-0.5 size-3.5 shrink-0 text-sky-500" />}
        <div>
          <p className="text-sm font-medium">{note.title}</p>
          <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <span className={`font-semibold ${status === 'overdue' ? 'text-red-600 dark:text-red-400' : 'text-sky-600 dark:text-sky-400'}`}>{status === 'overdue' ? overdueLabel : upcomingLabel}</span>
            · {dateStr}
          </p>
        </div>
      </div>
      <Button variant="ghost" size="icon-sm" onClick={onEdit}><PencilIcon className="size-3.5" /></Button>
    </div>
  );
}

function InteractionCard({ interaction, dateFormatter, onDelete, typeLabels, followUpLabel }: {
  interaction: InteractionItem; dateFormatter: Intl.DateTimeFormat; onDelete: () => void;
  typeLabels: Record<InteractionType, string>;
  followUpLabel: string;
}) {
  const colorClass = INTERACTION_COLORS[interaction.type];
  return (
    <div className={`rounded-xl border border-l-4 border-border/70 p-4 shadow-sm ${colorClass}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded bg-background/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{INTERACTION_ICONS[interaction.type]} {typeLabels[interaction.type]}</span>
          <p className="text-sm font-semibold">{interaction.title}</p>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onDelete}><Trash2Icon className="size-3.5 text-muted-foreground" /></Button>
      </div>
      {interaction.notes ? <p className="mt-1 text-sm text-muted-foreground">{interaction.notes}</p> : null}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="text-[11px] text-muted-foreground">{dateFormatter.format(new Date(interaction.date))}</span>
        {interaction.followUpDate ? (
          <span className="flex items-center gap-1 rounded-md bg-sky-100 px-1.5 py-0.5 text-[11px] font-medium text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">
            <ClockIcon className="size-3" />{followUpLabel}: {dateFormatter.format(new Date(interaction.followUpDate))}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function AttachmentRow({ attachment, dateFormatter, onDelete, downloadLabel, openLabel }: {
  attachment: AttachmentItem; dateFormatter: Intl.DateTimeFormat; onDelete: () => void; downloadLabel: string; openLabel: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-card px-4 py-3 shadow-sm">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
        {isImageType(attachment.fileType) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={attachment.fileUrl} alt={attachment.fileName} className="size-9 rounded-lg object-cover" />
        ) : (
          <FileTextIcon className="size-4" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{attachment.fileName}</p>
        <p className="text-[11px] text-muted-foreground">
          {dateFormatter.format(new Date(attachment.createdAt))}
          {attachment.fileSize ? ` · ${formatFileSize(attachment.fileSize)}` : ''}
        </p>
      </div>
      <div className="flex items-center gap-1.5">
        <Button variant="outline" size="sm" className="h-7 px-2 text-xs" asChild>
          <a href={attachment.fileUrl} target="_blank" rel="noopener noreferrer">{openLabel}</a>
        </Button>
        <Button variant="outline" size="sm" className="h-7 px-2 text-xs" asChild>
          <a href={attachment.fileUrl} target="_blank" rel="noopener noreferrer" download={attachment.fileName}>{downloadLabel}</a>
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={onDelete}><Trash2Icon className="size-3.5 text-muted-foreground" /></Button>
      </div>
    </div>
  );
}
