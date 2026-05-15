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
    {
      element: '[data-tour-dashboard-collection]',
      title: locale === 'fr' ? 'Recouvrement' : 'Collection',
      description:
        locale === 'fr'
          ? 'Suivez ici les niveaux de relance et les alertes de recouvrement en cours.'
          : 'Track reminder levels and current collection alerts from this card.',
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
    { element: '[data-tour-suppliers-header]', title: locale === 'fr' ? 'Gestion fournisseurs' : 'Supplier workspace', description: locale === 'fr' ? 'Gérez vos fournisseurs et centralisez vos relations opérationnelles.' : 'Manage suppliers and centralize your operational relationships.' },
    { element: '[data-tour-add-supplier]', title: locale === 'fr' ? 'Nouveau fournisseur' : 'New supplier', description: locale === 'fr' ? 'Ouvrez le panneau d\'ajout pour créer un fournisseur.' : 'Open the add panel to create a supplier.' },
    { element: '[data-tour-supplier-modal-name]', title: locale === 'fr' ? 'Raison sociale' : 'Legal name', description: locale === 'fr' ? 'Renseignez au minimum la raison sociale pour enregistrer un fournisseur.' : 'At minimum, enter the company legal name to save a supplier.' },
    { element: '[data-tour-supplier-modal-save]', title: locale === 'fr' ? 'Enregistrer fournisseur' : 'Save supplier', description: locale === 'fr' ? 'Validez ici pour ajouter le fournisseur à votre base.' : 'Confirm here to add the supplier to your database.' },
    { element: '[data-tour-suppliers-search]', title: locale === 'fr' ? 'Recherche fournisseur' : 'Supplier search', description: locale === 'fr' ? 'La recherche est simplifiée et s’applique automatiquement.' : 'Search is simplified and applies automatically.' },
    { element: '[data-tour-suppliers-grid]', title: locale === 'fr' ? 'Liste fournisseurs' : 'Supplier list', description: locale === 'fr' ? 'Ouvrez une fiche fournisseur pour notes et suivi.' : 'Open supplier details for notes and tracking.' },
  ],
  '/suppliers/[id]': (locale) => [
    { element: '[data-tour-supplier-actions]', title: locale === 'fr' ? 'Actions fournisseur' : 'Supplier actions', description: locale === 'fr' ? 'Modifiez, supprimez ou ajoutez une note.' : 'Edit, delete, or add supplier notes.' },
    { element: '[data-tour-supplier-profile]', title: locale === 'fr' ? 'Profil fournisseur' : 'Supplier profile', description: locale === 'fr' ? 'Retrouvez coordonnées et informations légales.' : 'See contact and legal information.' },
    { element: '[data-tour-supplier-timeline]', title: locale === 'fr' ? 'Timeline fournisseur' : 'Supplier timeline', description: locale === 'fr' ? 'Historique des notes et suivis.' : 'History of notes and follow-ups.' },
  ],
  '/catalogue': (locale) => [
    {
      element: '[data-tour-catalogue-header]',
      title: locale === 'fr' ? 'Étape 1 - Produits et services' : 'Step 1 - Products and services',
      description:
        locale === 'fr'
          ? 'Cette page centralise vos produits et services reutilisables pour devis et factures.'
          : 'This page centralizes reusable products and services for quotes and invoices.',
    },
    {
      element: '[data-tour-catalogue-quick-add]',
      title: locale === 'fr' ? 'Étape 2 - Ajout rapide' : 'Step 2 - Quick add',
      description:
        locale === 'fr'
          ? 'Ajoutez rapidement un produit/service réutilisable (nom, prix HT, type) sans ouvrir la modale.'
          : 'Quickly add a reusable product/service (name, price excl. tax, type) without opening the modal.',
    },
    {
      element: '[data-tour-catalogue-new-item]',
      title: locale === 'fr' ? 'Étape 3 - Formulaire complet' : 'Step 3 - Full form',
      description:
        locale === 'fr'
          ? 'Utilisez ce bouton si vous avez besoin de plus de détails (description, pièce jointe, TVA personnalisée).'
          : 'Use this button when you need advanced fields (description, attachment, custom VAT).',
    },
    {
      element: '[data-tour-catalogue-search]',
      title: locale === 'fr' ? 'Étape 4 - Recherche' : 'Step 4 - Search',
      description: locale === 'fr' ? 'Retrouvez vite un element par nom ou description.' : 'Find any item quickly by name or description.',
    },
    {
      element: '[data-tour-catalogue-filters]',
      title: locale === 'fr' ? 'Étape 5 - Filtres et tri' : 'Step 5 - Filters and sorting',
      description: locale === 'fr' ? 'Filtrez par type et triez par nom, prix ou date.' : 'Filter by type and sort by name, price, or date.',
    },
    {
      element: '[data-tour-catalogue-table]',
      title: locale === 'fr' ? 'Étape 6 - Table catalogue' : 'Step 6 - Catalogue table',
      description:
        locale === 'fr'
          ? 'Gerez vos produits/services depuis cette table: modifier, supprimer et reutiliser dans vos documents.'
          : 'Manage products/services from this table: edit, delete, and reuse in documents.',
    },
  ],
  '/quotes': (locale) => [
    {
      element: '[data-tour-quotes-header]',
      title: locale === 'fr' ? 'Étape 1 - Espace devis' : 'Step 1 - Quote workspace',
      description:
        locale === 'fr'
          ? 'Commencez ici: cette page centralise le suivi complet de vos devis.'
          : 'Start here: this page centralizes your full quote workflow.',
    },
    {
      element: '[data-tour-new-quote]',
      title: locale === 'fr' ? 'Étape 2 - Nouveau devis' : 'Step 2 - New quote',
      description:
        locale === 'fr'
          ? 'Créez rapidement un devis quand vous démarrez une nouvelle opportunité.'
          : 'Create a quote quickly when starting a new opportunity.',
    },
    {
      element: '[data-tour-quotes-filters]',
      title: locale === 'fr' ? 'Étape 3 - Filtrer la liste' : 'Step 3 - Filter the list',
      description:
        locale === 'fr'
          ? 'Affinez la vue par statut et recherchez par client ou numéro de devis.'
          : 'Narrow results by status and search by client or quote number.',
    },
    {
      element: '[data-tour-quotes-columns]',
      title: locale === 'fr' ? 'Étape 4 - Personnaliser les colonnes' : 'Step 4 - Customize columns',
      description:
        locale === 'fr'
          ? 'Ouvrez Colonnes, cochez les colonnes à afficher, puis cliquez sur Appliquer. Votre vue personnalisée est conservée.'
          : 'Open Columns, select which columns to show, then click Apply. Your custom view is saved.',
    },
    {
      element: '[data-tour-quotes-table]',
      title: locale === 'fr' ? 'Étape 5 - Table des devis' : 'Step 5 - Quotes table',
      description:
        locale === 'fr'
          ? 'Utilisez cette table avec les colonnes choisies pour ouvrir un devis et lancer les actions: voir, modifier, PDF, dupliquer, envoyer, historique et conversion en facture si éligible.'
          : 'Use this table with your chosen columns to open quotes and run actions: view, edit, PDF, duplicate, send, history, and convert to invoice when eligible.',
    },
    {
      element: '[data-tour-quotes-totals]',
      title: locale === 'fr' ? 'Étape 6 - Totaux visibles' : 'Step 6 - Visible totals',
      description:
        locale === 'fr'
          ? 'Ce resume calcule uniquement les devis affiches (page, filtres et recherche en cours): nombre, total HT, TVA, TTC et total accepte.'
          : 'This summary calculates only visible quotes (current page, filters, and search): count, subtotal, VAT, grand total, and accepted total.',
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
    {
      element: '[data-tour-invoices-header]',
      title: locale === 'fr' ? 'Étape 1 - Espace factures' : 'Step 1 - Invoice workspace',
      description:
        locale === 'fr'
          ? 'Commencez ici: suivez les paiements, les retards et les échéances en un seul endroit.'
          : 'Start here: track payments, overdue items, and due dates in one place.',
    },
    {
      element: '[data-tour-new-invoice]',
      title: locale === 'fr' ? 'Étape 2 - Nouvelle facture' : 'Step 2 - New invoice',
      description:
        locale === 'fr'
          ? 'Créez une facture manuelle ou générez-la depuis un devis converti.'
          : 'Create an invoice manually or generate it from a converted quote.',
    },
    {
      element: '[data-tour-invoices-filters]',
      title: locale === 'fr' ? 'Étape 3 - Filtrer la liste' : 'Step 3 - Filter the list',
      description:
        locale === 'fr'
          ? 'Filtrez rapidement les factures impayées, partiellement payées, payées ou en retard.'
          : 'Quickly filter unpaid, partially paid, paid, or overdue invoices.',
    },
    {
      element: '[data-tour-invoices-columns]',
      title: locale === 'fr' ? 'Étape 4 - Personnaliser les colonnes' : 'Step 4 - Customize columns',
      description:
        locale === 'fr'
          ? 'Ouvrez Colonnes, sélectionnez les informations utiles (montant payé, restant, progression, etc.), puis cliquez sur Appliquer.'
          : 'Open Columns, select the fields you need (amount paid, remaining amount, progress, etc.), then click Apply.',
    },
    {
      element: '[data-tour-invoices-table]',
      title: locale === 'fr' ? 'Étape 5 - Table factures' : 'Step 5 - Invoice table',
      description:
        locale === 'fr'
          ? 'Dans cette table personnalisée, gérez chaque facture: ouvrir, modifier (si éligible), envoyer, PDF, suppression, marquage payé et solde des acomptes.'
          : 'In this customized table, manage each invoice: open, edit (when eligible), send, PDF, delete, mark as paid, and settle deposit balances.',
    },
    {
      element: '[data-tour-invoices-totals]',
      title: locale === 'fr' ? 'Étape 6 - Totaux visibles' : 'Step 6 - Visible totals',
      description:
        locale === 'fr'
          ? 'Ce resume calcule uniquement les factures affichees (page, filtres et recherche en cours): nombre, total HT, TVA, TTC, total paye et total restant.'
          : 'This summary calculates only visible invoices (current page, filters, and search): count, subtotal, VAT, grand total, total paid, and total due.',
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
    {
      element: '[data-tour-invoice-collection]',
      title: locale === 'fr' ? 'Relances et recouvrement' : 'Reminders and collection',
      description:
        locale === 'fr'
          ? 'Utilisez cet onglet pour envoyer des relances, mettre en pause/reprendre et suivre l\'historique de recouvrement.'
          : 'Use this tab to send reminders, pause/resume flow, and review collection history.',
    },
  ],
  '/profile': (locale) => [
    { element: '[data-tour-profile-company-card]', title: locale === 'fr' ? 'Profil entreprise' : 'Company profile', description: locale === 'fr' ? 'Mettez à jour vos informations société.' : 'Update your company information.' },
    { element: '[data-tour-profile-legal-fields]', title: locale === 'fr' ? 'Conformité légale' : 'Legal compliance fields', description: locale === 'fr' ? 'Renseignez RCS, autorisation, matricule, IBAN et identifiants légaux selon votre pays.' : 'Fill in RCS, authorization, matricule, IBAN, and legal identifiers based on your country.' },
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
      element: '[data-tour-notes-header]',
      title: locale === 'fr' ? 'Étape 1 - Espace notes' : 'Step 1 - Notes workspace',
      description:
        locale === 'fr'
          ? 'Cette page centralise vos notes de suivi liees aux clients et fournisseurs.'
          : 'This page centralizes follow-up notes linked to clients and suppliers.',
    },
    {
      element: '[data-tour-notes-add]',
      title: locale === 'fr' ? 'Étape 2 - Créer une note' : 'Step 2 - Create a note',
      description:
        locale === 'fr'
          ? 'Utilisez ce bouton pour ajouter une nouvelle note et la lier à un client ou un fournisseur.'
          : 'Use this button to create a new note and link it to a client or supplier.',
    },
    {
      element: '[data-tour-notes-search]',
      title: locale === 'fr' ? 'Étape 3 - Recherche' : 'Step 3 - Search',
      description:
        locale === 'fr'
          ? 'Retrouvez rapidement une note par contenu, client, fournisseur ou objet associe.'
          : 'Find a note quickly by content, client, supplier, or linked subject.',
    },
    {
      element: '[data-tour-notes-filter]',
      title: locale === 'fr' ? 'Étape 4 - Filtres' : 'Step 4 - Filters',
      description:
        locale === 'fr'
          ? 'Filtrez les notes selon leur statut pour vous concentrer sur les actions a traiter.'
          : 'Filter notes by status to focus on the actions that need attention.',
    },
    {
      element: '[data-tour-notes-list]',
      title: locale === 'fr' ? 'Étape 5 - Liste des notes' : 'Step 5 - Notes list',
      description:
        locale === 'fr'
          ? 'Parcourez les cartes de notes et ouvrez les actions rapides pour modifier, supprimer ou marquer terminee.'
          : 'Browse note cards and use quick actions to edit, delete, or mark done.',
    },
    {
      element: '[data-tour-notes-panel]',
      title: locale === 'fr' ? 'Étape 6 - Panneau principal' : 'Step 6 - Main panel',
      description:
        locale === 'fr'
          ? 'Ici vous gérez toutes les notes: consulter, modifier, supprimer, marquer un suivi terminé, et ouvrir le client/fournisseur lié.'
          : 'This is your notes grid where you can manage everything: view, edit, delete, mark follow-up done, and open the linked client/supplier.',
    },
  ],
  '/expenses': (locale) => [
    {
      element: '[data-tour-expenses-header]',
      title: locale === 'fr' ? 'Étape 1 - Espace dépenses' : 'Step 1 - Expenses workspace',
      description:
        locale === 'fr'
          ? 'Cette page centralise la capture, la création manuelle et la gestion complète de vos dépenses.'
          : 'This page centralizes capture, manual entry, and full lifecycle management of your expenses.',
    },
    {
      element: '[data-tour-expenses-capture]',
      title: locale === 'fr' ? 'Étape 2 - Modes de saisie' : 'Step 2 - Entry methods',
      description:
        locale === 'fr'
          ? 'Ajoutez une dépense en prenant une photo, en important un fichier, par glisser-déposer, ou via le formulaire manuel.'
          : 'Add expenses by taking a photo, importing a file, drag-and-drop, or opening the manual form.',
    },
    {
      element: '[data-tour-expenses-filters]',
      title: locale === 'fr' ? 'Étape 3 - Filtres et tri' : 'Step 3 - Filters and sorting',
      description:
        locale === 'fr'
          ? 'Filtrez par statut, paiement, catégorie, fournisseur ou période pour retrouver rapidement une dépense.'
          : 'Filter by status, payment, category, supplier, or date range to find any expense quickly.',
    },
    {
      element: '[data-tour-expenses-list]',
      title: locale === 'fr' ? 'Étape 4 - Liste des dépenses' : 'Step 4 - Expenses list',
      description:
        locale === 'fr'
          ? 'Gérez chaque dépense depuis cette liste: ouvrir, modifier, dupliquer, archiver, marquer payée ou supprimer.'
          : 'Manage each expense from this list: open, edit, duplicate, archive, mark as paid, or delete.',
    },
  ],
  '/tickets': (locale) => [
    {
      element: '[data-tour-tickets-header]',
      title: locale === 'fr' ? 'Étape 1 - Espace tickets' : 'Step 1 - Tickets workspace',
      description:
        locale === 'fr'
          ? 'Les tickets permettent de suivre les discussions internes liées à vos dépenses, factures, fournisseurs et clients.'
          : 'Tickets let you track internal threads linked to expenses, invoices, suppliers, and clients.',
    },
    {
      element: '[data-tour-new-ticket]',
      title: locale === 'fr' ? 'Étape 2 - Nouveau ticket' : 'Step 2 - New ticket',
      description:
        locale === 'fr'
          ? 'Créez un ticket pour lancer une discussion, soumettre un document ou signaler un litige.'
          : 'Create a ticket to start a thread, submit a document, or flag a dispute.',
    },
    {
      element: '[data-tour-tickets-filters]',
      title: locale === 'fr' ? 'Étape 3 - Filtres' : 'Step 3 - Filters',
      description:
        locale === 'fr'
          ? 'Filtrez par statut, type, lien, ou cochez les cases pour voir les tickets qui vous sont assignés ou que vous avez créés.'
          : 'Filter by status, type, linked record, or use checkboxes to see tickets assigned to or created by you.',
    },
    {
      element: '[data-tour-tickets-list]',
      title: locale === 'fr' ? 'Étape 4 - Liste des tickets' : 'Step 4 - Ticket list',
      description:
        locale === 'fr'
          ? 'Parcourez la liste et ouvrez un ticket pour répondre, changer le statut ou consulter l\'historique des échanges.'
          : 'Browse the list and open a ticket to reply, change status, or review the full conversation history.',
    },
  ],
  '/settings': (locale) => [
    {
      element: '[data-tour-settings-header]',
      title: locale === 'fr' ? 'Étape 1 - Paramètres' : 'Step 1 - Settings',
      description:
        locale === 'fr'
          ? 'Configurez ici les paiements Stripe, les relances automatiques, les modèles d\'emails, les récurrences et la gestion des utilisateurs.'
          : 'Configure Stripe payments, automatic reminders, email templates, recurrence rules, and user management here.',
    },
    {
      element: '[data-tour-settings-nav]',
      title: locale === 'fr' ? 'Étape 2 - Navigation paramètres' : 'Step 2 - Settings navigation',
      description:
        locale === 'fr'
          ? 'Naviguez entre les sections: Vue d\'ensemble, Relances, Paiements, Dépenses et Utilisateurs selon vos besoins.'
          : 'Navigate between sections: Overview, Reminders, Payments, Expenses, and Users as needed.',
    },
  ],
};

const TOUR_STORAGE_KEY_BY_ROUTE: Partial<Record<string, string>> = {
  '/catalogue': '/catalogue:v2',
  '/quotes': '/quotes:v2',
  '/invoices': '/invoices:v2',
  '/notes': '/notes:v2',
  '/expenses': '/expenses:v1',
  '/tickets': '/tickets:v1',
  '/settings': '/settings:v1',
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
