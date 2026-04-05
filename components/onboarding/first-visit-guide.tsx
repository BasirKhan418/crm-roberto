'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { driver } from 'driver.js';

import { useLocale } from '@/components/providers/locale-provider';

type Locale = 'en' | 'fr';

interface TourStep {
  element: string;
  title: string;
  description: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
}

const TOUR_BY_ROUTE: Record<string, (locale: Locale) => TourStep[]> = {
  '/onboarding': (locale) => [
    {
      element: 'form',
      title: locale === 'fr' ? 'Bienvenue' : 'Welcome',
      description:
        locale === 'fr'
          ? 'Remplissez ce formulaire une seule fois pour terminer votre configuration.'
          : 'Complete this form once to finish your initial setup.',
    },
  ],
  '/dashboard': (locale) => [
    { element: '[data-tour-dashboard-header]', title: locale === 'fr' ? 'Vue globale' : 'Business overview', description: locale === 'fr' ? 'Ce bloc vous donne les actions rapides et la vue synthétique.' : 'This section gives your main overview and fast actions.' },
    { element: '[data-tour-create-client]', title: locale === 'fr' ? 'Ajouter un client' : 'Add a client', description: locale === 'fr' ? 'Commencez ici pour créer votre base clients.' : 'Start here to create your client base.' },
    { element: '[data-tour-create-supplier]', title: locale === 'fr' ? 'Ajouter un fournisseur' : 'Add a supplier', description: locale === 'fr' ? 'Ajoutez vos fournisseurs pour organiser vos opérations.' : 'Add suppliers to structure your operations.' },
    { element: '[data-tour-create-note]', title: locale === 'fr' ? 'Créer une note' : 'Create a note', description: locale === 'fr' ? 'Capturez une tâche ou un suivi important.' : 'Capture an important task or follow-up.' },
    { element: '[data-tour-create-quote]', title: locale === 'fr' ? 'Créer un devis' : 'Create a quote', description: locale === 'fr' ? 'Créez rapidement un devis depuis le tableau de bord.' : 'Create a quote directly from the dashboard.' },
    { element: '[data-tour-dashboard-priority]', title: locale === 'fr' ? 'Actions prioritaires' : 'Priority actions', description: locale === 'fr' ? 'Cette section met en avant ce qui doit être traité en premier.' : 'This section surfaces what requires attention first.' },
    { element: '[data-tour-dashboard-activity]', title: locale === 'fr' ? 'Flux activité' : 'Activity feed', description: locale === 'fr' ? 'Suivez les événements récents et ajoutez une note.' : 'Track recent events and add notes quickly.' },
    { element: '[data-tour-dashboard-followups]', title: locale === 'fr' ? 'Suivis' : 'Follow-ups', description: locale === 'fr' ? 'Traitez les échéances en retard ou à venir.' : 'Handle overdue and upcoming follow-ups.' },
    {
      element: '[data-tour-dashboard-stats]',
      title: locale === 'fr' ? 'Statistiques clés' : 'Key stats',
      description:
        locale === 'fr'
          ? 'Ces cartes montrent vos indicateurs principaux: clients, fournisseurs, notes, devis et revenu accepté.'
          : 'These cards show your main business stats: clients, suppliers, notes, quotes, and accepted revenue.',
    },
    { element: '[data-tour-dashboard-recent-quotes]', title: locale === 'fr' ? 'Devis récents' : 'Recent quotes', description: locale === 'fr' ? 'Ouvrez un devis et convertissez-le en facture quand il est accepté et signé.' : 'Open a quote and convert it to invoice once accepted and signed.' },
  ],
  '/clients': (locale) => [
    { element: '[data-tour-clients-header]', title: locale === 'fr' ? 'Gestion clients' : 'Client workspace', description: locale === 'fr' ? 'Cette page centralise tout le suivi client.' : 'This page centralizes all client management.' },
    { element: '[data-tour-add-client]', title: locale === 'fr' ? 'Nouveau client' : 'New client', description: locale === 'fr' ? 'Ouvrez le formulaire pour créer un client.' : 'Open the form to create a client.' },
    { element: '[data-tour-clients-search]', title: locale === 'fr' ? 'Recherche' : 'Search', description: locale === 'fr' ? 'Filtrez rapidement vos clients.' : 'Filter your clients quickly.' },
    { element: '[data-tour-clients-grid]', title: locale === 'fr' ? 'Fiches clients' : 'Client cards', description: locale === 'fr' ? 'Ouvrez une fiche pour voir profil, notes, interactions et devis.' : 'Open a card to view profile, notes, interactions, and quotes.' },
  ],
  '/clients/[id]': (locale) => [
    { element: '[data-tour-client-actions]', title: locale === 'fr' ? 'Actions rapides' : 'Quick actions', description: locale === 'fr' ? 'Créez un devis, une facture, une note ou une interaction.' : 'Create a quote, invoice, note, or interaction.' },
    { element: '[data-tour-client-profile-card]', title: locale === 'fr' ? 'Profil client' : 'Client profile', description: locale === 'fr' ? 'Coordonnées, statut, et édition du client.' : 'Contact data, status, and edit controls.' },
    { element: '[data-tour-client-billing-card]', title: locale === 'fr' ? 'Facturation' : 'Billing', description: locale === 'fr' ? 'Vérifiez les données de facturation.' : 'Check billing details here.' },
    { element: '[data-tour-client-tabs]', title: locale === 'fr' ? 'Sections détaillées' : 'Detailed sections', description: locale === 'fr' ? 'Naviguez entre timeline, notes, interactions, devis et pièces jointes.' : 'Switch between timeline, notes, interactions, quotes, and attachments.' },
  ],
  '/suppliers': (locale) => [
    { element: '[data-tour-suppliers-header]', title: locale === 'fr' ? 'Gestion fournisseurs' : 'Supplier workspace', description: locale === 'fr' ? 'Suivez vos fournisseurs et l’historique opérationnel.' : 'Track suppliers and operational history.' },
    { element: '[data-tour-add-supplier]', title: locale === 'fr' ? 'Nouveau fournisseur' : 'New supplier', description: locale === 'fr' ? 'Ajoutez un fournisseur avec ses informations essentielles.' : 'Add a supplier with key information.' },
    { element: '[data-tour-suppliers-search]', title: locale === 'fr' ? 'Recherche fournisseur' : 'Supplier search', description: locale === 'fr' ? 'Filtrez par nom, e-mail ou entreprise.' : 'Filter by name, email, or company.' },
    { element: '[data-tour-suppliers-grid]', title: locale === 'fr' ? 'Liste fournisseurs' : 'Supplier list', description: locale === 'fr' ? 'Ouvrez une fiche fournisseur pour notes et suivi.' : 'Open supplier details for notes and tracking.' },
  ],
  '/suppliers/[id]': (locale) => [
    { element: '[data-tour-supplier-actions]', title: locale === 'fr' ? 'Actions fournisseur' : 'Supplier actions', description: locale === 'fr' ? 'Modifiez, supprimez ou ajoutez une note.' : 'Edit, delete, or add supplier notes.' },
    { element: '[data-tour-supplier-profile]', title: locale === 'fr' ? 'Profil fournisseur' : 'Supplier profile', description: locale === 'fr' ? 'Retrouvez coordonnées et informations légales.' : 'See contact and legal information.' },
    { element: '[data-tour-supplier-timeline]', title: locale === 'fr' ? 'Timeline fournisseur' : 'Supplier timeline', description: locale === 'fr' ? 'Historique des notes et suivis.' : 'History of notes and follow-ups.' },
  ],
  '/catalogue': (locale) => [
    { element: '[data-tour-catalogue-header]', title: locale === 'fr' ? 'Produits & services' : 'Products & services', description: locale === 'fr' ? 'Gérez vos éléments réutilisables pour devis/factures.' : 'Manage reusable items for quotes/invoices.' },
    {
      element: '[data-tour-catalogue-quick-add]',
      title: locale === 'fr' ? 'Ajout rapide' : 'Quick add',
      description:
        locale === 'fr'
          ? 'Ajoutez rapidement un produit/service réutilisable (nom, prix HT, type) sans ouvrir la modale.'
          : 'Quickly add a reusable product/service (name, price excl. tax, type) without opening the modal.',
    },
    {
      element: '[data-tour-catalogue-new-item]',
      title: locale === 'fr' ? 'Formulaire complet' : 'Full form',
      description:
        locale === 'fr'
          ? 'Utilisez ce bouton si vous avez besoin de plus de détails (description, pièce jointe, TVA personnalisée).'
          : 'Use this button when you need advanced fields (description, attachment, custom VAT).',
    },
    { element: '[data-tour-catalogue-search]', title: locale === 'fr' ? 'Recherche catalogue' : 'Catalogue search', description: locale === 'fr' ? 'Filtrez et retrouvez rapidement un élément.' : 'Filter and find items quickly.' },
    { element: '[data-tour-catalogue-filters]', title: locale === 'fr' ? 'Filtres et tri' : 'Filters and sorting', description: locale === 'fr' ? 'Filtrez par type et triez par nom, prix ou date.' : 'Filter by type and sort by name, price, or date.' },
    { element: '[data-tour-catalogue-table]', title: locale === 'fr' ? 'Table catalogue' : 'Catalogue table', description: locale === 'fr' ? 'Modifiez ou supprimez vos éléments depuis cette table.' : 'Edit or delete your items from this table.' },
  ],
  '/quotes': (locale) => [
    { element: '[data-tour-quotes-header]', title: locale === 'fr' ? 'Gestion devis' : 'Quote management', description: locale === 'fr' ? 'Suivez le cycle complet de vos devis.' : 'Track the complete lifecycle of your quotes.' },
    { element: '[data-tour-new-quote]', title: locale === 'fr' ? 'Nouveau devis' : 'New quote', description: locale === 'fr' ? 'Créez un devis rapidement.' : 'Create a quote quickly.' },
    { element: '[data-tour-quotes-filters]', title: locale === 'fr' ? 'Filtres devis' : 'Quote filters', description: locale === 'fr' ? 'Filtrez par statut et recherchez par client/numéro.' : 'Filter by status and search by client/number.' },
    {
      element: '[data-tour-quotes-table]',
      title: locale === 'fr' ? 'Table des devis' : 'Quotes table',
      description:
        locale === 'fr'
          ? 'Ici vous voyez tous les devis et toutes les actions rapides. Ouvrez un devis, puis utilisez les actions détaillées: voir, modifier, PDF, dupliquer, envoyer, historique et convertir en facture quand éligible.'
          : 'This is your quotes table with all quick actions. Open any quote, then use detailed actions: view, edit, PDF, duplicate, send, history, and convert to invoice when eligible.',
    },
  ],
  '/quotes/new': (locale) => [
    {
      element: '[data-tour-quote-client-step]',
      title: locale === 'fr' ? 'Sélection client' : 'Client selection',
      description:
        locale === 'fr'
          ? 'Choisissez ici le client du devis. Cette sélection alimente les informations du document final.'
          : 'Select the quote client here. This drives the customer details on the final document.',
    },
    {
      element: '[data-tour-quote-subject]',
      title: locale === 'fr' ? 'Objet du devis' : 'Quote subject',
      description:
        locale === 'fr'
          ? 'Ajoutez ici un objet clair (ex: prestation, projet) pour mieux identifier le devis.'
          : 'Add a clear subject here (service/project) to identify the quote quickly.',
    },
    {
      element: '[data-tour-quote-items-step]',
      title: locale === 'fr' ? 'Lignes du devis' : 'Quote line items',
      description:
        locale === 'fr'
          ? 'Ajoutez produits/services, quantités, remises et TVA. Vous pouvez construire tout le devis depuis cette section.'
          : 'Add products/services, quantities, discounts, and VAT. You can build the full quote from this section.',
    },
    {
      element: '[data-tour-quote-totals-step]',
      title: locale === 'fr' ? 'Totaux calculés' : 'Computed totals',
      description:
        locale === 'fr'
          ? 'Vérifiez ici HT, TVA et TTC en temps réel avant validation.'
          : 'Review subtotal, VAT, and grand total in real time before validation.',
    },
    {
      element: '[data-tour-quote-save-actions]',
      title: locale === 'fr' ? 'Actions de sauvegarde' : 'Save actions',
      description:
        locale === 'fr'
          ? 'Depuis cette zone vous pouvez enregistrer en brouillon ou enregistrer et envoyer immédiatement le devis.'
          : 'From this area you can save as draft or save and send the quote immediately.',
    },
  ],
  '/quotes/[id]': (locale) => [
    { element: '[data-tour-quote-detail-actions]', title: locale === 'fr' ? 'Actions devis' : 'Quote actions', description: locale === 'fr' ? 'Modifier, envoyer, télécharger ou supprimer.' : 'Edit, send, download, or delete.' },
    { element: '[data-tour-quote-convert]', title: locale === 'fr' ? 'Convertir en facture' : 'Convert to invoice', description: locale === 'fr' ? 'Disponible quand le devis est accepté et signé.' : 'Available when the quote is accepted and signed.' },
    { element: '[data-tour-quote-document]', title: locale === 'fr' ? 'Document devis' : 'Quote document', description: locale === 'fr' ? 'Détails client, lignes et totaux du devis.' : 'Client info, line items, and totals.' },
  ],
  '/invoices': (locale) => [
    { element: '[data-tour-invoices-header]', title: locale === 'fr' ? 'Gestion factures' : 'Invoice management', description: locale === 'fr' ? 'Suivez statut de paiement et échéances.' : 'Track payment status and due dates.' },
    { element: '[data-tour-new-invoice]', title: locale === 'fr' ? 'Nouvelle facture' : 'New invoice', description: locale === 'fr' ? 'Créez une facture manuelle ou depuis un devis.' : 'Create an invoice manually or from a quote.' },
    { element: '[data-tour-invoices-filters]', title: locale === 'fr' ? 'Filtres factures' : 'Invoice filters', description: locale === 'fr' ? 'Filtrez impayé, payé, retard, acompte.' : 'Filter unpaid, paid, overdue, or deposit-paid.' },
    {
      element: '[data-tour-invoices-table]',
      title: locale === 'fr' ? 'Table factures' : 'Invoice table',
      description:
        locale === 'fr'
          ? 'Depuis cette table vous gérez tout: ouvrir, modifier (si éligible), envoyer au client, télécharger PDF, supprimer, marquer payée, et solder une facture avec acompte.'
          : 'From this table you can manage everything: open, edit (when eligible), send to client, download PDF, delete, mark as paid, and mark remaining balance paid for deposit invoices.',
    },
  ],
  '/invoices/new': (locale) => [
    {
      element: '[data-tour-invoice-client-step]',
      title: locale === 'fr' ? 'Client de facturation' : 'Invoice client',
      description:
        locale === 'fr'
          ? 'Sélectionnez ici le client à facturer avant de définir les lignes.'
          : 'Select the billing client here before defining line items.',
    },
    {
      element: '[data-tour-invoice-due-date]',
      title: locale === 'fr' ? 'Date d\'échéance' : 'Due date',
      description:
        locale === 'fr'
          ? 'Définissez la date limite de paiement pour clarifier l\'échéance côté client.'
          : 'Set the payment deadline here so the client sees the expected due date clearly.',
    },
    {
      element: '[data-tour-invoice-items-step]',
      title: locale === 'fr' ? 'Lignes de facture' : 'Invoice line items',
      description:
        locale === 'fr'
          ? 'Ajoutez les éléments facturés avec quantité, prix et TVA pour générer un total exact.'
          : 'Add billed items with quantity, price, and VAT to produce an exact total.',
    },
    {
      element: '[data-tour-invoice-totals-step]',
      title: locale === 'fr' ? 'Résumé des montants' : 'Amount summary',
      description:
        locale === 'fr'
          ? 'Contrôlez ici les montants calculés avant création de la facture.'
          : 'Validate computed totals here before creating the invoice.',
    },
    {
      element: '[data-tour-invoice-create-action]',
      title: locale === 'fr' ? 'Créer la facture' : 'Create invoice',
      description:
        locale === 'fr'
          ? 'Cette action finalise la facture. Vous pourrez ensuite envoyer, télécharger PDF et suivre le paiement.'
          : 'This action finalizes the invoice. Then you can send it, download PDF, and track payment status.',
    },
  ],
  '/invoices/[id]': (locale) => [
    { element: '[data-tour-invoice-detail-actions]', title: locale === 'fr' ? 'Actions facture' : 'Invoice actions', description: locale === 'fr' ? 'Envoyer, télécharger PDF, marquer payé.' : 'Send, download PDF, mark as paid.' },
    { element: '[data-tour-invoice-document]', title: locale === 'fr' ? 'Document facture' : 'Invoice document', description: locale === 'fr' ? 'Consultez informations, lignes, totaux et paiements.' : 'Review details, line items, totals, and payments.' },
  ],
  '/profile': (locale) => [
    { element: '[data-tour-profile-company-card]', title: locale === 'fr' ? 'Profil entreprise' : 'Company profile', description: locale === 'fr' ? 'Mettez à jour vos informations société.' : 'Update your company information.' },
    { element: '[data-tour-profile-save]', title: locale === 'fr' ? 'Enregistrer profil' : 'Save profile', description: locale === 'fr' ? 'Enregistrez les changements de votre identité société.' : 'Save company profile changes.' },
    { element: '[data-tour-profile-logo-card]', title: locale === 'fr' ? 'Logo entreprise' : 'Company logo', description: locale === 'fr' ? 'Ajoutez votre logo pour devis et factures.' : 'Upload your logo for quotes and invoices.' },
    { element: '[data-tour-profile-password-card]', title: locale === 'fr' ? 'Sécurité mot de passe' : 'Password security', description: locale === 'fr' ? 'Mettez à jour votre mot de passe ici.' : 'Update your password here.' },
    {
      element: '[data-tour-profile-stripe-card]',
      title: locale === 'fr' ? 'Paiements Stripe' : 'Stripe payments',
      description:
        locale === 'fr'
          ? 'Cette section active les paiements en ligne pour vos factures: connexion Stripe, vérification du compte, encaissement et suivi automatique des paiements.'
          : 'This section enables online invoice payments: connect Stripe, complete account verification, receive payouts, and keep payment tracking automatic.',
    },
    {
      element: '[data-tour-profile-stripe-cta]',
      title: locale === 'fr' ? 'Configurer Stripe' : 'Configure Stripe',
      description:
        locale === 'fr'
          ? 'Cliquez ici pour ouvrir les paramètres Stripe, lancer ou reprendre l\'onboarding, et vérifier le statut de connexion/paiement.'
          : 'Click here to open Stripe settings, start or resume onboarding, and check connection/payment status.',
    },
    {
      element: '[data-tour-profile-restart-tour]',
      title: locale === 'fr' ? 'Relancer la visite' : 'Restart platform tour',
      description:
        locale === 'fr'
          ? 'Ce bouton réinitialise tous les guides de la plateforme et vous redirige vers le tableau de bord pour recommencer la visite complète.'
          : 'This button resets all platform guide progress and redirects you to dashboard to run the full guided tour again.',
    },
  ],
  '/notes': (locale) => [
    {
      element: '[data-tour-notes-add]',
      title: locale === 'fr' ? 'Créer une note' : 'Create a note',
      description:
        locale === 'fr'
          ? 'Utilisez ce bouton pour ajouter une nouvelle note et la lier à un client ou un fournisseur.'
          : 'Use this button to create a new note and link it to a client or supplier.',
    },
    {
      element: '[data-tour-notes-panel]',
      title: locale === 'fr' ? 'Table des notes' : 'Notes table',
      description:
        locale === 'fr'
          ? 'Ici vous gérez toutes les notes: consulter, modifier, supprimer, marquer un suivi terminé, et ouvrir le client/fournisseur lié.'
          : 'This is your notes grid where you can manage everything: view, edit, delete, mark follow-up done, and open the linked client/supplier.',
    },
  ],
};

const TOUR_STORAGE_KEY_BY_ROUTE: Partial<Record<string, string>> = {
  '/notes': '/notes:v2',
};

function normalizePathKey(pathname: string): string {
  const cleaned = pathname.replace(/\/+$/, '') || '/';

  if (TOUR_BY_ROUTE[cleaned]) {
    return cleaned;
  }

  const segments = cleaned.split('/').filter(Boolean);
  for (let i = 1; i < segments.length; i += 1) {
    const candidate = `/${segments
      .map((segment, idx) => (idx === i ? '[id]' : segment))
      .join('/')}`;

    if (TOUR_BY_ROUTE[candidate]) {
      return candidate;
    }
  }

  const fallback = segments
    .map((segment) => {
      if (/^[0-9]+$/.test(segment)) return '[id]';
      if (/^[a-f0-9]{24}$/i.test(segment)) return '[id]';
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(segment)) return '[id]';
      if (segment.length > 28 && /^[A-Za-z0-9_-]+$/.test(segment)) return '[id]';
      return segment;
    })
    .join('/');

  return `/${fallback}`;
}

export default function FirstVisitGuide() {
  const pathname = usePathname();
  const { locale } = useLocale();

  const [seenPages, setSeenPages] = useState<string[]>([]);
  const [loadingSeen, setLoadingSeen] = useState(true);
  const driverRef = useRef<ReturnType<typeof driver> | null>(null);

  const pageKey = useMemo(() => normalizePathKey(pathname), [pathname]);
  const storageKey = useMemo(() => TOUR_STORAGE_KEY_BY_ROUTE[pageKey] ?? pageKey, [pageKey]);
  const localeKey: Locale = locale === 'fr' ? 'fr' : 'en';
  const steps = useMemo(() => {
    const builder = TOUR_BY_ROUTE[pageKey];
    return builder ? builder(localeKey) : [];
  }, [localeKey, pageKey]);

  useEffect(() => {
    let cancelled = false;

    async function loadSeenPages() {
      setLoadingSeen(true);
      try {
        const response = await fetch('/api/onboarding/guide', { cache: 'no-store' });
        const payload = (await response.json()) as { success?: boolean; data?: { seenPages?: string[] } };

        if (!cancelled && response.ok && payload.success) {
          setSeenPages(Array.isArray(payload.data?.seenPages) ? payload.data!.seenPages! : []);
        }
      } catch {
        if (!cancelled) {
          setSeenPages([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingSeen(false);
        }
      }
    }

    void loadSeenPages();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (loadingSeen) return;
    if (!steps.length) return;
    if (seenPages.includes(storageKey)) return;

    const timeout = window.setTimeout(() => {
      const validSteps = steps.filter((step) => document.querySelector(step.element));
      if (!validSteps.length) {
        return;
      }

      const tour = driver({
        showProgress: true,
        animate: true,
        smoothScroll: true,
        allowClose: true,
        overlayClickBehavior: 'close',
        nextBtnText: localeKey === 'fr' ? 'Suivant' : 'Next',
        prevBtnText: localeKey === 'fr' ? 'Précédent' : 'Previous',
        doneBtnText: localeKey === 'fr' ? 'Terminer' : 'Done',
        onDestroyed: () => {
          void fetch('/api/onboarding/guide', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pageKey: storageKey }),
          });
          setSeenPages((prev) => (prev.includes(storageKey) ? prev : [...prev, storageKey]));
        },
        steps: validSteps.map((step) => ({
          element: step.element,
          popover: {
            title: step.title,
            description: step.description,
            side: step.side ?? 'bottom',
            align: step.align ?? 'start',
          },
        })),
      });

      driverRef.current = tour;
      tour.drive();
    }, 500);

    return () => {
      window.clearTimeout(timeout);
      if (driverRef.current) {
        driverRef.current.destroy();
      }
    };
  }, [loadingSeen, seenPages, steps, pageKey, storageKey, localeKey]);

  return null;
}
