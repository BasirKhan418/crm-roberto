export type TranslationLocale = 'en' | 'fr';

const I18N_PREFIX = '__i18n__:';

const messages = {
  en: {
    common: {
      closeModal: 'Close modal',
      genericErrorRefresh: 'Something went wrong. Please refresh.',
      toggleLanguage: 'Toggle language',
      showPassword: 'Show password',
      hidePassword: 'Hide password',
      companyLogo: 'Company logo',
      name: 'Name',
      company: 'Company',
    },
    validation: {
      invalidInput: 'Invalid input',
      invalidEmailAddress: 'Invalid email address',
      invalidBusinessEmail: 'Invalid business email',
      clientNameRequired: 'Client name is required',
      supplierNameRequired: 'Supplier name is required',
      invalidId: 'Invalid id',
      lineItemImageUrlInvalid: 'Line item image must be a valid URL',
      lineItemNameRequired: 'Line item name is required',
      quantityMin: 'Quantity must be at least 1',
      baseUnitPriceNonNegative: 'Base unit price excluding tax cannot be negative',
      unitPriceNonNegative: 'Unit price excluding tax cannot be negative',
      discountNonNegative: 'Discount cannot be negative',
      discountMax: 'Discount cannot exceed 100',
      vatRateNonNegative: 'VAT rate cannot be negative',
      vatRateMax: 'VAT rate cannot exceed 100',
      lineItemsRequired: 'At least one line item is required',
      notesMax2000: 'Notes cannot exceed 2000 characters',
      paymentTermsMax500: 'Payment terms cannot exceed 500 characters',
      validityMin: 'Validity must be at least 1 day',
      updateAtLeastOneField: 'At least one field must be provided for update',
      statusRequired: 'Status is required',
      passwordMin8: 'Password must be at least 8 characters',
      nameRequired: 'Name is required',
      passwordRequired: 'Password is required',
      currentPasswordRequired: 'Current password is required',
      confirmPasswordRequired: 'Confirm password is required',
      passwordsDoNotMatch: 'Passwords do not match',
      newPasswordMustDiffer: 'New password must be different from current password',
      invalidLinkedId: 'Invalid linkedId',
      followUpDateFormat: 'followUpDate must be ISO date or yyyy-mm-dd',
      followUpDateRequired: 'Follow-up date is required',
      titleRequired: 'Title is required',
      descriptionRequired: 'Description is required',
      linkedRelationPairRequired: 'linkedType and linkedId must be provided together when changing relation',
      descriptionMax1000: 'Description cannot exceed 1000 characters',
      attachmentUrlInvalid: 'Attachment url must be a valid URL',
      itemNameRequired: 'Item name is required',
      nameMax200: 'Name cannot exceed 200 characters',
      priceExcludingTaxNonNegative: 'Price excluding tax cannot be negative',
      priceIncludingTaxNonNegative: 'Price including tax cannot be negative',
      invalidUserId: 'Invalid user ID',
      invalidPhone:
        'Invalid phone number. Accepted formats include international numbers like +352 or 00352, and local numbers.',
      companyNameRequired: 'Company name is required',
      firstNameRequired: 'First name is required',
      lastNameRequired: 'Last name is required',
      ownerNameRequired: 'Owner name is required',
      addressRequired: 'Address is required',
      vatNumberRequired: 'VAT number is required',
      enterValidBusinessEmail: 'Please enter a valid business email address.',
      invalidStatusValue: 'Invalid status value',
      otpMin6: 'OTP must be at least 6 characters',
      tokenRequired: 'Token is required',
      invalidEntityId: 'Invalid entityId',
      entityNameRequired: 'entityName is required',
      fullNameMin2: 'Full Name must be at least 2 characters',
      invalidEmailFormat: 'Invalid email format',
      confirmPasswordPrompt: 'Please confirm your password',
      otpExact6: 'OTP must be exactly 6 digits',
      passwordRequiredForAccountAccess: 'Password is required to access your account.',
      fileNameRequired: 'File name is required',
      invalidFileUrl: 'Invalid file URL',
      dateRequired: 'Date is required',
      validationError: 'Validation error',
    },
    statuses: {
      quote: {
        draft: 'Draft',
        sent: 'Sent',
        accepted: 'Accepted',
        refused: 'Refused',
        rejected: 'Rejected',
      },
      invoice: {
        unpaid: 'Unpaid',
        partial_paid: 'Partially paid',
        paid: 'Paid',
        overdue: 'Overdue',
      },
      quoteDatePrefix: {
        draft: 'Created on',
        sent: 'Sent on',
        accepted: 'Accepted on',
        refused: 'Refused on',
        rejected: 'Rejected on',
        fallback: 'Updated on',
      },
      actionRequired: 'Action required',
    },
    activity: {
      title: 'Recent Activity',
      empty: 'No activity yet. Add your first client to get started.',
      fallbackHeadline: 'Activity',
      badges: {
        client_created: 'Created',
        client_updated: 'Updated',
        client_deleted: 'Deleted',
        supplier_created: 'Created',
        supplier_updated: 'Updated',
        supplier_deleted: 'Deleted',
        note_created: 'Created',
        note_updated: 'Updated',
        note_deleted: 'Deleted',
        quote_created: 'Created',
        quote_duplicated: 'Duplicated',
        quote_updated: 'Updated',
        quote_deleted: 'Deleted',
        quote_client_replied: 'Client replied',
        quote_status_changed: 'Status changed',
        invoice_reminder_sent: 'Reminder sent',
        invoice_formal_notice_sent: 'Formal notice sent',
        invoice_recurrence_generated: 'Recurrence generated',
        invoice_recurrence_due: 'Recurrence due',
        invoice_payment_received: 'Payment received',
        invoice_payment_updated: 'Payment updated',
        invoice_payment_deleted: 'Payment deleted',
      },
      headlines: {
        client_created: 'Client added',
        client_updated: 'Client updated',
        client_deleted: 'Client removed',
        supplier_created: 'Supplier added',
        supplier_updated: 'Supplier updated',
        supplier_deleted: 'Supplier removed',
        note_created: 'Note created',
        note_updated: 'Note updated',
        note_deleted: 'Note deleted',
        quote_created: 'Quote created',
        quote_duplicated: 'Quote duplicated',
        quote_updated: 'Quote updated',
        quote_deleted: 'Quote deleted',
        quote_client_replied: 'Client replied to quote',
        quote_status_changed: 'Quote status changed',
        invoice_created: 'Invoice created',
        invoice_reminder_sent: 'Invoice reminder sent',
        invoice_formal_notice_sent: 'Formal notice sent for invoice',
        invoice_recurrence_generated: 'Recurring invoice generated',
        invoice_recurrence_due: 'Recurring invoice is due',
        invoice_payment_received: 'Invoice payment received',
        invoice_payment_updated: 'Invoice payment updated',
        invoice_payment_deleted: 'Invoice payment deleted',
      },
      relative: {
        justNow: 'Just now',
        minutesAgo: '{count}m ago',
        hoursAgo: '{count}h ago',
        yesterday: 'Yesterday',
      },
    },
    notes: {
      followUpDone: 'Follow-up marked as done',
      clearFollowUpFailed: 'Failed to clear follow-up',
    },
    email: {
      greeting: 'Hello {name},',
      pdfAttached: 'PDF attached for your records.',
      sendSignLink: {
        subject: 'Quote {quoteNumber} - Please review and sign',
        documentLabel: 'Quote',
        amountLabel: 'Amount',
        validityLabel: 'Validity',
        validityValue: '{count} days',
        messageBody:
          'Please review and sign the attached quote using this secure link:\n{signUrl}\n\nThis link expires in 30 days.\n\nIf this button does not work, use this link to continue:\n{signUrl}',
        ctaLabel: 'Review and Sign Quote',
        ctaNote: 'This link expires in 30 days.',
      },
      sendQuote: {
        subject: 'Quote {quoteNumber} - Please review and sign',
        defaultBody:
          'Hello,\n\nPlease find attached your quote {quoteNumber}.\n\nWhen you are ready, use the secure button in this email to review the quote and sign online.\n\nFeel free to contact us if you have any questions before signing.\n\nBest regards,',
        reference: 'Quote reference: {quoteNumber}',
        totalInclTax: 'Total incl. tax: {amount}',
        validity: 'Validity: {count} days',
        signingLink: 'Secure signing link: {signUrl}',
        signingExpiry: 'This link expires in 30 days.',
      },
      sendInvoice: {
        subject: 'Invoice {invoiceNumber} - {amount}',
        documentLabel: 'Invoice',
        messageBody: 'Please find your invoice attached. You can complete payment using the button below.',
        messageBodyNoPayment: 'Please find your invoice attached. If you have any questions, feel free to reply to this email.',
        amountDue: 'Amount due',
        payment: 'Payment',
        onlineCheckout: 'Online checkout',
        ctaLabel: 'Pay now',
        textBody: 'Hello {name},\n\nYour invoice {invoiceNumber} ({amount}) is attached.\nPay online: {paymentUrl}',
      },
      rejection: {
        subject: 'Quote {quoteNumber} has been rejected by {clientName}',
        noComment: 'The client did not leave a comment.',
        commentLine: 'The client left the following comment:\n\n"{comment}"',
        messageBody:
          '{clientName} has rejected quote {quoteNumber}.\n\n{commentLine}\n\nYou can review the quote and resend an updated version using the button below.',
        documentLabel: 'Quote',
        clientLabel: 'Client',
        actionLabel: 'Action',
        actionRejected: 'Rejected',
        commentLabel: 'Comment',
        ctaLabel: 'View quote',
      },
      rejectionReply: {
        subject: 'Update on your quote {quoteNumber}',
        documentLabel: 'Quote',
        ctaLabel: 'View updated quote',
        ctaNote: 'Use the secure link above to view the latest version of your quote once it is resent.',
      },
      clientReply: {
        subject: 'Client replied to quote {quoteNumber}',
        documentLabel: 'Quote',
        clientLabel: 'Client',
        ctaLabel: 'View quote & reply',
      },
      paymentReceipt: {
        subject: 'Payment receipt - {invoiceNumber}',
        documentLabel: 'Payment receipt',
        messageBody: 'We confirm that your payment has been received successfully.',
        amountPaid: 'Amount paid',
        method: 'Method',
        paidAt: 'Paid at',
        textBody:
          'Hello {name},\n\nPayment received for invoice {invoiceNumber}.\nAmount: {amount}\nMethod: {paymentMethod}\nPaid at: {paidAt}',
      },
    },
    reminders: {
      settings: {
        title: 'Reminder Settings',
        description: 'Configure timing, message templates, late fees, and legal notice options for invoice reminders.',
        loading: 'Loading reminder settings...',
        authRequired: 'You must be signed in to view reminder settings.',
        loadFailed: 'Failed to load reminder settings',
        retry: 'Retry',
        saveFailedGeneric: 'Unable to save reminder settings',
        offsets: 'Timing',
        templatesTitle: 'Email Templates',
        lateFee: 'Late Fees',
        legalNotice: 'Legal Notice',
        resetSection: 'Reset to defaults',
        common: {
          saving: 'Saving...',
          resetting: 'Resetting...',
        },
        timing: {
          description: 'Define when each reminder level should be sent after the due date.',
          fields: {
            soft: 'Soft (days)',
            medium: 'Medium (days)',
            firm: 'Firm (days)',
            formalNotice: 'Formal Notice (days)',
          },
          validationRule: 'Rule: soft < medium < firm <= formal notice',
          invalidToast: 'Timing is invalid. Required order: soft < medium < firm <= formal notice.',
          saveButton: 'Save timing',
          savedToast: 'Timing settings saved',
        },
        templatesSectionDescription: 'Edit reminder subjects and body content in both English and French.',
        templates: {
          cardDescription: 'Each template supports variables like {{clientName}} and {{invoiceNumber}}.',
          tab: {
            en: 'EN',
            fr: 'FR',
          },
          subject: 'Subject',
          subjectPlaceholder: 'Enter email subject',
          body: 'Body',
          bodyPlaceholder: 'Write your reminder email message...',
          preview: 'Live Preview',
          sampleVariables: 'Sample Variables',
          saveButton: 'Save template',
          saveFailed: 'Unable to save template',
          savedToast: 'Template saved: {level}',
          resetButton: 'Reset to default',
          resetFailed: 'Unable to reset template',
          resetToast: 'Template reset to default: {level}',
        },
        lateFees: {
          description: 'Set optional late fee rules applied on overdue invoices.',
          enable: 'Enable late fees',
          enableHelp: 'When enabled, late fees are included in reminder context.',
          type: 'Type',
          fixedAmount: 'Fixed amount',
          percentage: 'Percentage',
          value: 'Value',
          valueHelpFixed: 'Fixed amount in EUR',
          valueHelpPercent: 'Percentage value (e.g. 5 for 5%)',
          applyFrom: 'Apply from',
          saveButton: 'Save late fees',
          savedToast: 'Late fee settings saved',
        },
        legalNoticeSection: {
          description: 'Configure legal notice delay and optional legal footer clause.',
          delay: 'Delay',
          delay8: '8 days',
          delay15: '15 days',
          includeInterestClause: 'Include interest clause',
          customFooter: 'Custom footer (optional)',
          customFooterPlaceholder: 'Additional legal note shown in formal notice emails.',
          saveButton: 'Save legal notice',
          savedToast: 'Legal notice settings saved',
        },
      },
      levels: {
        soft: 'Soft reminder',
        medium: 'Medium reminder',
        firm: 'Firm reminder',
        formalNotice: 'Formal notice',
      },
      status: {
        notStarted: 'Not started',
        paused: 'Paused',
        softSent: 'Soft sent',
        mediumSent: 'Medium sent',
        firmSent: 'Firm sent',
        formalNoticeSent: 'Formal notice sent',
      },
      actions: {
        sendNow: 'Send reminder now',
        pause: 'Pause reminders',
        resume: 'Resume reminders',
        downloadNotice: 'Download legal notice',
        skipNext: 'Skip next reminder',
      },
      history: {
        title: 'Reminder history',
      },
      nextScheduled: 'Next reminder in {days} days',
      collection: {
        tab: 'Collection',
        title: 'Collection status',
        description: 'Track reminder progression and manage collection actions.',
        completed: 'Completed',
        notScheduled: 'Not scheduled',
        actionFailed: 'Failed to update collection state',
        pauseSuccess: 'Reminders paused',
        resumeSuccess: 'Reminders resumed',
        skipSuccess: 'Next reminder skipped',
        loadingHistory: 'Loading reminder history...',
        historyLoadFailed: 'Failed to load reminder history',
        noHistory: 'No reminder events yet.',
        loadMore: 'Load more',
        loadingMore: 'Loading...',
        viaEmail: 'via email',
        historyStatus: {
          sent: 'sent',
          failed: 'failed',
          skipped: 'skipped',
        },
        sendModal: {
          title: 'Send reminder now',
          description: 'Choose a level and edit subject/body before sending.',
          level: 'Reminder level',
          cancel: 'Cancel',
          send: 'Send',
          sending: 'Sending...',
          sendSuccess: 'Reminder sent successfully',
          sendFailed: 'Failed to send reminder',
        },
      },
    },
    recurring: {
      card: {
        title: 'Recurrence',
        empty: 'Make this invoice recurring',
      },
      setupCta: 'Set up recurrence',
      frequency: {
        monthly: 'Monthly',
        quarterly: 'Quarterly',
        yearly: 'Yearly',
        custom: 'Custom',
      },
      actions: {
        generate: 'Generate next invoice',
        stop: 'Stop recurrence',
        stopReason: 'Reason (optional)',
      },
      setup: {
        title: 'Set up recurrence',
        description: 'Configure how and when this invoice should repeat.',
        frequency: 'Frequency',
        customIntervalDays: 'Custom interval (days)',
        repeatUntilOptional: 'Repeat until (optional)',
        autoGenerateHelp: 'When enabled, the next invoice is generated automatically.',
        autoSendHelp: 'Only available when auto-generate is enabled.',
        cancel: 'Cancel',
        save: 'Save',
        saving: 'Saving...',
        saveFailed: 'Failed to save recurrence settings',
        saved: 'Recurrence saved',
      },
      generateNow: 'Generate now',
      generateFailed: 'Failed to generate recurring invoice',
      generated: 'Recurring invoice generated',
      stopFailed: 'Failed to stop recurrence',
      stopped: 'Recurrence stopped',
      stoppedOn: 'Recurrence stopped on {date}',
      restart: 'Restart recurrence',
      lastGeneratedInvoice: 'Open generated invoice',
      stopDialog: {
        title: 'Stop recurrence?',
        description: 'This stops future automatic generation for this invoice.',
        reasonPlaceholder: 'Add an optional reason...',
        cancel: 'Cancel',
        confirm: 'Stop recurrence',
      },
      autoGenerate: 'Auto-generate next invoice',
      autoSend: 'Auto-send to client',
      nextOccurrence: 'Next occurrence',
      lastGenerated: 'Last generated',
    },
    invoices: {
      tabs: {
        payments: 'Payments',
      },
    },
  },
  fr: {
    common: {
      closeModal: 'Fermer la fen\u00eatre',
      genericErrorRefresh: 'Une erreur est survenue. Veuillez actualiser.',
      toggleLanguage: 'Changer la langue',
      showPassword: 'Afficher le mot de passe',
      hidePassword: 'Masquer le mot de passe',
      companyLogo: 'Logo de l\'entreprise',
      name: 'Nom',
      company: 'Entreprise',
    },
    validation: {
      invalidInput: 'Saisie invalide',
      invalidEmailAddress: 'Adresse e-mail invalide',
      invalidBusinessEmail: 'E-mail professionnel invalide',
      clientNameRequired: 'Le nom du client est requis',
      supplierNameRequired: 'Le nom du fournisseur est requis',
      invalidId: 'Identifiant invalide',
      lineItemImageUrlInvalid: "L'image de la ligne doit être une URL valide",
      lineItemNameRequired: 'Le nom de la ligne est requis',
      quantityMin: "La quantité doit être d'au moins 1",
      baseUnitPriceNonNegative: 'Le prix unitaire HT de base ne peut pas être négatif',
      unitPriceNonNegative: 'Le prix unitaire HT ne peut pas être négatif',
      discountNonNegative: 'La remise ne peut pas être négative',
      discountMax: 'La remise ne peut pas dépasser 100',
      vatRateNonNegative: 'Le taux de TVA ne peut pas être négatif',
      vatRateMax: 'Le taux de TVA ne peut pas dépasser 100',
      lineItemsRequired: 'Au moins une ligne est requise',
      notesMax2000: 'Les notes ne peuvent pas dépasser 2000 caractères',
      paymentTermsMax500: 'Les conditions de paiement ne peuvent pas dépasser 500 caractères',
      validityMin: "La validité doit être d'au moins 1 jour",
      updateAtLeastOneField: 'Au moins un champ doit être fourni pour la mise à jour',
      statusRequired: 'Le statut est requis',
      passwordMin8: 'Le mot de passe doit contenir au moins 8 caractères',
      nameRequired: 'Le nom est requis',
      passwordRequired: 'Le mot de passe est requis',
      currentPasswordRequired: 'Le mot de passe actuel est requis',
      confirmPasswordRequired: 'La confirmation du mot de passe est requise',
      passwordsDoNotMatch: 'Les mots de passe ne correspondent pas',
      newPasswordMustDiffer: "Le nouveau mot de passe doit être différent de l'actuel",
      invalidLinkedId: 'linkedId invalide',
      followUpDateFormat: 'followUpDate doit être une date ISO ou au format aaaa-mm-jj',
      followUpDateRequired: 'La date de suivi est requise',
      titleRequired: 'Le titre est requis',
      descriptionRequired: 'La description est requise',
      linkedRelationPairRequired: 'linkedType et linkedId doivent être fournis ensemble lors du changement de relation',
      descriptionMax1000: 'La description ne peut pas dépasser 1000 caractères',
      attachmentUrlInvalid: "L'URL de la pièce jointe doit être valide",
      itemNameRequired: "Le nom de l'élément est requis",
      nameMax200: 'Le nom ne peut pas dépasser 200 caractères',
      priceExcludingTaxNonNegative: 'Le prix HT ne peut pas être négatif',
      priceIncludingTaxNonNegative: 'Le prix TTC ne peut pas être négatif',
      invalidUserId: 'Identifiant utilisateur invalide',
      invalidPhone:
        'Numero de telephone invalide. Formats acceptes : numeros internationaux comme +352 ou 00352, et numeros locaux.',
      companyNameRequired: "Le nom de l'entreprise est requis",
      firstNameRequired: 'Le prénom est requis',
      lastNameRequired: 'Le nom est requis',
      ownerNameRequired: 'Le nom du responsable est requis',
      addressRequired: "L'adresse est requise",
      vatNumberRequired: 'Le numéro de TVA est requis',
      enterValidBusinessEmail: 'Veuillez saisir une adresse e-mail professionnelle valide.',
      invalidStatusValue: 'Valeur de statut invalide',
      otpMin6: 'Le code OTP doit contenir au moins 6 caractères',
      tokenRequired: 'Le jeton est requis',
      invalidEntityId: 'entityId invalide',
      entityNameRequired: 'entityName est requis',
      fullNameMin2: 'Le nom complet doit contenir au moins 2 caractères',
      invalidEmailFormat: "Format d'e-mail invalide",
      confirmPasswordPrompt: 'Veuillez confirmer votre mot de passe',
      otpExact6: 'Le code OTP doit contenir exactement 6 chiffres',
      passwordRequiredForAccountAccess: 'Le mot de passe est requis pour accéder à votre compte.',
      fileNameRequired: 'Le nom du fichier est requis',
      invalidFileUrl: 'URL de fichier invalide',
      dateRequired: 'La date est requise',
      validationError: 'Erreur de validation',
    },
    statuses: {
      quote: {
        draft: 'Brouillon',
        sent: 'Envoyé',
        accepted: 'Accepté',
        refused: 'Refusé',
        rejected: 'Refusé (client)',
      },
      invoice: {
        unpaid: 'Impayée',
        partial_paid: 'Partiellement payée',
        paid: 'Payée',
        overdue: 'En retard',
      },
      quoteDatePrefix: {
        draft: 'Créé le',
        sent: 'Envoyé le',
        accepted: 'Accepté le',
        refused: 'Refusé le',
        rejected: 'Refusé le',
        fallback: 'Mis à jour le',
      },
      actionRequired: 'Action requise',
    },
    activity: {
      title: 'Activité Récente',
      empty: 'Aucune activité pour le moment. Ajoutez votre premier client pour commencer.',
      fallbackHeadline: 'Activité',
      badges: {
        client_created: 'Créé',
        client_updated: 'Modifié',
        client_deleted: 'Supprimé',
        supplier_created: 'Créé',
        supplier_updated: 'Modifié',
        supplier_deleted: 'Supprimé',
        note_created: 'Créée',
        note_updated: 'Modifiée',
        note_deleted: 'Supprimée',
        quote_created: 'Créé',
        quote_duplicated: 'Dupliqué',
        quote_updated: 'Modifié',
        quote_deleted: 'Supprimé',
        quote_client_replied: 'Le client a répondu',
        quote_status_changed: 'Statut modifié',
        invoice_reminder_sent: 'Relance envoyée',
        invoice_formal_notice_sent: 'Mise en demeure envoyée',
        invoice_recurrence_generated: 'Récurrence générée',
        invoice_recurrence_due: 'Récurrence arrivée à échéance',
        invoice_payment_received: 'Paiement reçu',
        invoice_payment_updated: 'Paiement modifié',
        invoice_payment_deleted: 'Paiement supprimé',
      },
      headlines: {
        client_created: 'Client ajouté',
        client_updated: 'Client mis à jour',
        client_deleted: 'Client supprimé',
        supplier_created: 'Fournisseur ajouté',
        supplier_updated: 'Fournisseur mis à jour',
        supplier_deleted: 'Fournisseur supprimé',
        note_created: 'Note créée',
        note_updated: 'Note mise à jour',
        note_deleted: 'Note supprimée',
        quote_created: 'Devis créé',
        quote_duplicated: 'Devis dupliqué',
        quote_updated: 'Devis mis à jour',
        quote_deleted: 'Devis supprimé',
        quote_client_replied: 'Le client a répondu au devis',
        quote_status_changed: 'Statut du devis modifié',
        invoice_created: 'Facture créée',
        invoice_reminder_sent: 'Relance de facture envoyée',
        invoice_formal_notice_sent: 'Mise en demeure de facture envoyée',
        invoice_recurrence_generated: 'Facture récurrente générée',
        invoice_recurrence_due: 'Facture récurrente arrivée à échéance',
        invoice_payment_received: 'Paiement de facture reçu',
        invoice_payment_updated: 'Paiement de facture modifié',
        invoice_payment_deleted: 'Paiement de facture supprimé',
      },
      relative: {
        justNow: "À l'instant",
        minutesAgo: 'Il y a {count} min',
        hoursAgo: 'Il y a {count} h',
        yesterday: 'Hier',
      },
    },
    notes: {
      followUpDone: 'Suivi marqué comme terminé',
      clearFollowUpFailed: 'Impossible de supprimer le suivi',
    },
    email: {
      greeting: 'Bonjour {name},',
      pdfAttached: 'PDF joint pour vos archives.',
      sendSignLink: {
        subject: 'Devis {quoteNumber} - Merci de vérifier et signer',
        documentLabel: 'Devis',
        amountLabel: 'Montant',
        validityLabel: 'Validité',
        validityValue: '{count} jours',
        messageBody:
          'Veuillez vérifier et signer le devis ci-joint en utilisant ce lien sécurisé :\n{signUrl}\n\nCe lien expire dans 30 jours.\n\nSi ce bouton ne fonctionne pas, utilisez ce lien pour continuer :\n{signUrl}',
        ctaLabel: 'Vérifier et signer le devis',
        ctaNote: 'Ce lien expire dans 30 jours.',
      },
      sendQuote: {
        subject: 'Devis {quoteNumber} - Merci de vérifier et signer',
        defaultBody:
          'Bonjour,\n\nVeuillez trouver ci-joint votre devis {quoteNumber}.\n\nLorsque vous êtes prêt, utilisez le bouton sécurisé de cet e-mail pour consulter le devis et signer en ligne.\n\nN\'hésitez pas à revenir vers nous pour toute question avant signature.\n\nBien cordialement,',
        reference: 'Référence du devis : {quoteNumber}',
        totalInclTax: 'Montant TTC : {amount}',
        validity: 'Validité : {count} jours',
        signingLink: 'Lien sécurisé pour signer : {signUrl}',
        signingExpiry: 'Ce lien expire dans 30 jours.',
      },
      sendInvoice: {
        subject: 'Facture {invoiceNumber} - {amount}',
        documentLabel: 'Facture',
        messageBody: 'Veuillez trouver votre facture en pièce jointe. Vous pouvez effectuer le paiement avec le bouton ci-dessous.',
        messageBodyNoPayment: 'Veuillez trouver votre facture en pièce jointe. Si vous avez des questions, vous pouvez répondre à cet e-mail.',
        amountDue: 'Montant dû',
        payment: 'Paiement',
        onlineCheckout: 'Paiement en ligne',
        ctaLabel: 'Payer maintenant',
        textBody: 'Bonjour {name},\n\nVotre facture {invoiceNumber} ({amount}) est jointe.\nPayer en ligne : {paymentUrl}',
      },
      rejection: {
        subject: 'Le devis {quoteNumber} a été refusé par {clientName}',
        noComment: "Le client n'a laissé aucun commentaire.",
        commentLine: 'Le client a laissé le commentaire suivant :\n\n"{comment}"',
        messageBody:
          '{clientName} a refusé le devis {quoteNumber}.\n\n{commentLine}\n\nVous pouvez consulter le devis et renvoyer une version mise à jour avec le bouton ci-dessous.',
        documentLabel: 'Devis',
        clientLabel: 'Client',
        actionLabel: 'Action',
        actionRejected: 'Refusé',
        commentLabel: 'Commentaire',
        ctaLabel: 'Voir le devis',
      },
      rejectionReply: {
        subject: 'Mise à jour de votre devis {quoteNumber}',
        documentLabel: 'Devis',
        ctaLabel: 'Voir le devis mis à jour',
        ctaNote: "Utilisez le lien sécurisé ci-dessus pour consulter la dernière version de votre devis une fois qu'il sera renvoyé.",
      },
      clientReply: {
        subject: 'Le client a répondu au devis {quoteNumber}',
        documentLabel: 'Devis',
        clientLabel: 'Client',
        ctaLabel: 'Voir le devis et répondre',
      },
      paymentReceipt: {
        subject: 'Reçu de paiement - {invoiceNumber}',
        documentLabel: 'Reçu de paiement',
        messageBody: 'Nous confirmons que votre paiement a été reçu avec succès.',
        amountPaid: 'Montant réglé',
        method: 'Méthode',
        paidAt: 'Payé le',
        textBody:
          'Bonjour {name},\n\nPaiement reçu pour la facture {invoiceNumber}.\nMontant : {amount}\nMéthode : {paymentMethod}\nPayé le : {paidAt}',
      },
    },
    reminders: {
      settings: {
        title: 'Paramètres de relance',
        description: 'Configurez les délais, les modèles de messages, les pénalités et les options de mise en demeure.',
        loading: 'Chargement des paramètres de relance...',
        authRequired: 'Vous devez être connecté pour consulter les paramètres de relance.',
        loadFailed: 'Impossible de charger les paramètres de relance',
        retry: 'Réessayer',
        saveFailedGeneric: 'Impossible d\'enregistrer les paramètres de relance',
        offsets: 'Délais',
        templatesTitle: "Modèles d'e-mail",
        lateFee: 'Pénalités de retard',
        legalNotice: 'Mise en demeure',
        resetSection: 'Réinitialiser',
        common: {
          saving: 'Enregistrement...',
          resetting: 'Réinitialisation...',
        },
        timing: {
          description: 'Définissez quand chaque niveau de relance doit être envoyé après échéance.',
          fields: {
            soft: 'Rappel amical (jours)',
            medium: 'Relance intermédiaire (jours)',
            firm: 'Relance ferme (jours)',
            formalNotice: 'Mise en demeure (jours)',
          },
          validationRule: 'Règle : soft < medium < firm <= mise en demeure',
          invalidToast: 'Les délais sont invalides. Ordre requis : soft < medium < firm <= mise en demeure.',
          saveButton: 'Enregistrer les délais',
          savedToast: 'Délais enregistrés',
        },
        templatesSectionDescription: 'Modifiez les sujets et contenus des relances en anglais et en français.',
        templates: {
          cardDescription: 'Chaque modèle supporte des variables comme {{clientName}} et {{invoiceNumber}}.',
          tab: {
            en: 'EN',
            fr: 'FR',
          },
          subject: 'Sujet',
          subjectPlaceholder: 'Saisissez le sujet de l\'e-mail',
          body: 'Corps',
          bodyPlaceholder: 'Rédigez votre message de relance...',
          preview: 'Aperçu en direct',
          sampleVariables: 'Variables d\'exemple',
          saveButton: 'Enregistrer le modèle',
          saveFailed: 'Impossible d\'enregistrer le modèle',
          savedToast: 'Modèle enregistré : {level}',
          resetButton: 'Réinitialiser par défaut',
          resetFailed: 'Impossible de réinitialiser le modèle',
          resetToast: 'Modèle réinitialisé : {level}',
        },
        lateFees: {
          description: 'Définissez les règles de pénalités applicables aux factures en retard.',
          enable: 'Activer les pénalités de retard',
          enableHelp: 'Quand activé, les pénalités sont incluses dans le contexte des relances.',
          type: 'Type',
          fixedAmount: 'Montant fixe',
          percentage: 'Pourcentage',
          value: 'Valeur',
          valueHelpFixed: 'Montant fixe en EUR',
          valueHelpPercent: 'Valeur en pourcentage (ex: 5 pour 5%)',
          applyFrom: 'Appliquer à partir de',
          saveButton: 'Enregistrer les pénalités',
          savedToast: 'Paramètres de pénalités enregistrés',
        },
        legalNoticeSection: {
          description: 'Configurez le délai légal et un éventuel pied de page juridique.',
          delay: 'Délai',
          delay8: '8 jours',
          delay15: '15 jours',
          includeInterestClause: 'Inclure la clause d\'intérêts',
          customFooter: 'Pied de page personnalisé (optionnel)',
          customFooterPlaceholder: 'Note juridique supplémentaire affichée dans les e-mails de mise en demeure.',
          saveButton: 'Enregistrer la mise en demeure',
          savedToast: 'Paramètres de mise en demeure enregistrés',
        },
      },
      levels: {
        soft: 'Rappel amical',
        medium: 'Rappel ferme',
        firm: 'Dernier rappel',
        formalNotice: 'Mise en demeure',
      },
      status: {
        notStarted: 'Non démarré',
        paused: 'En pause',
        softSent: 'Rappel amical envoyé',
        mediumSent: 'Rappel ferme envoyé',
        firmSent: 'Dernier rappel envoyé',
        formalNoticeSent: 'Mise en demeure envoyée',
      },
      actions: {
        sendNow: 'Envoyer maintenant',
        pause: 'Mettre en pause',
        resume: 'Reprendre',
        downloadNotice: 'Télécharger la mise en demeure',
        skipNext: 'Ignorer le prochain rappel',
      },
      history: {
        title: 'Historique des relances',
      },
      nextScheduled: 'Prochain rappel dans {days} jours',
      collection: {
        tab: 'Relances',
        title: 'Suivi des relances',
        description: 'Suivez la progression des relances et gérez les actions de recouvrement.',
        completed: 'Terminé',
        notScheduled: 'Non planifié',
        actionFailed: 'Impossible de mettre à jour l\'état des relances',
        pauseSuccess: 'Relances mises en pause',
        resumeSuccess: 'Relances reprises',
        skipSuccess: 'Prochaine relance ignorée',
        loadingHistory: 'Chargement de l\'historique des relances...',
        historyLoadFailed: 'Impossible de charger l\'historique des relances',
        noHistory: 'Aucun événement de relance pour le moment.',
        loadMore: 'Charger plus',
        loadingMore: 'Chargement...',
        viaEmail: 'via e-mail',
        historyStatus: {
          sent: 'envoyé',
          failed: 'échec',
          skipped: 'ignoré',
        },
        sendModal: {
          title: 'Envoyer une relance',
          description: 'Choisissez un niveau et modifiez le sujet/corps avant envoi.',
          level: 'Niveau de relance',
          cancel: 'Annuler',
          send: 'Envoyer',
          sending: 'Envoi...',
          sendSuccess: 'Relance envoyée avec succès',
          sendFailed: 'Impossible d\'envoyer la relance',
        },
      },
    },
    recurring: {
      card: {
        title: 'Récurrence',
        empty: 'Rendre cette facture récurrente',
      },
      setupCta: 'Configurer la récurrence',
      frequency: {
        monthly: 'Mensuel',
        quarterly: 'Trimestriel',
        yearly: 'Annuel',
        custom: 'Personnalisé',
      },
      actions: {
        generate: 'Générer la prochaine facture',
        stop: 'Arrêter la récurrence',
        stopReason: 'Raison (optionnel)',
      },
      setup: {
        title: 'Configurer la récurrence',
        description: 'Définissez comment et quand cette facture doit se répéter.',
        frequency: 'Fréquence',
        customIntervalDays: 'Intervalle personnalisé (jours)',
        repeatUntilOptional: 'Répéter jusqu\'au (optionnel)',
        autoGenerateHelp: 'Quand activé, la prochaine facture est générée automatiquement.',
        autoSendHelp: 'Disponible uniquement si la génération auto est activée.',
        cancel: 'Annuler',
        save: 'Enregistrer',
        saving: 'Enregistrement...',
        saveFailed: 'Impossible d\'enregistrer la récurrence',
        saved: 'Récurrence enregistrée',
      },
      generateNow: 'Générer maintenant',
      generateFailed: 'Impossible de générer la facture récurrente',
      generated: 'Facture récurrente générée',
      stopFailed: 'Impossible d\'arrêter la récurrence',
      stopped: 'Récurrence arrêtée',
      stoppedOn: 'Récurrence arrêtée le {date}',
      restart: 'Redémarrer la récurrence',
      lastGeneratedInvoice: 'Ouvrir la facture générée',
      stopDialog: {
        title: 'Arrêter la récurrence ?',
        description: 'Cela arrête les prochaines générations automatiques pour cette facture.',
        reasonPlaceholder: 'Ajoutez une raison optionnelle...',
        cancel: 'Annuler',
        confirm: 'Arrêter la récurrence',
      },
      autoGenerate: 'Générer automatiquement',
      autoSend: 'Envoyer automatiquement au client',
      nextOccurrence: 'Prochaine échéance',
      lastGenerated: 'Dernière génération',
    },
    invoices: {
      tabs: {
        payments: 'Paiements',
      },
    },
  },
} as const;

function interpolate(template: string, replacements?: Record<string, string | number | null | undefined>) {
  if (!replacements) {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (_match, key) => String(replacements[key] ?? ''));
}

function getMessage(locale: TranslationLocale, key: string): string | undefined {
  const source = messages[locale] as Record<string, unknown>;
  let current: unknown = source;

  for (const segment of key.split('.')) {
    if (!current || typeof current !== 'object' || !(segment in (current as Record<string, unknown>))) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }

  return typeof current === 'string' ? current : undefined;
}

export function createI18nKey(key: string): string {
  return `${I18N_PREFIX}${key}`;
}

export function isI18nKey(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.startsWith(I18N_PREFIX);
}

export function translate(locale: TranslationLocale, key: string, replacements?: Record<string, string | number | null | undefined>): string {
  const template = getMessage(locale, key) ?? getMessage('en', key) ?? key;
  return interpolate(template, replacements);
}

export function resolveTranslatedText(
  locale: TranslationLocale,
  value: string | null | undefined,
  fallback?: string,
  replacements?: Record<string, string | number | null | undefined>
): string {
  const source = value ?? fallback ?? '';
  if (!source) {
    return '';
  }

  if (isI18nKey(source)) {
    return translate(locale, source.slice(I18N_PREFIX.length), replacements);
  }

  return interpolate(source, replacements);
}

export function resolveTranslatedError(locale: TranslationLocale, error: unknown, fallback: string): string {
  if (error instanceof Error) {
    return resolveTranslatedText(locale, error.message, fallback);
  }

  return resolveTranslatedText(locale, undefined, fallback);
}

export function translateFieldErrors<T extends Record<string, string[] | undefined>>(
  locale: TranslationLocale,
  fieldErrors: T | null | undefined
): T {
  if (!fieldErrors) {
    return {} as T;
  }

  return Object.fromEntries(
    Object.entries(fieldErrors).map(([field, errors]) => [
      field,
      Array.isArray(errors) ? errors.map((message) => resolveTranslatedText(locale, message)) : errors,
    ])
  ) as T;
}

export function getQuoteStatusLabel(locale: TranslationLocale, status: string): string {
  return translate(locale, `statuses.quote.${status}`);
}

const INVOICE_DISPLAY_PREFIX: Record<TranslationLocale, string> = {
  en: 'INV',
  fr: 'FAC',
};

function splitInvoiceReference(invoiceNumber: string): { prefix: string; suffix: string } | null {
  const trimmed = invoiceNumber.trim();
  const separatorIndex = trimmed.indexOf('-');

  if (separatorIndex <= 0) {
    return null;
  }

  const prefix = trimmed.slice(0, separatorIndex).toUpperCase();
  if (prefix !== INVOICE_DISPLAY_PREFIX.en && prefix !== INVOICE_DISPLAY_PREFIX.fr) {
    return null;
  }

  return {
    prefix,
    suffix: trimmed.slice(separatorIndex),
  };
}

export function getInvoiceStatusLabel(locale: TranslationLocale, status: string): string {
  return getMessage(locale, `statuses.invoice.${status}`)
    ?? getMessage('en', `statuses.invoice.${status}`)
    ?? status;
}

export function formatInvoiceDisplayNumber(locale: TranslationLocale, invoiceNumber: string): string {
  const parts = splitInvoiceReference(invoiceNumber);
  if (!parts) {
    return invoiceNumber;
  }

  return `${INVOICE_DISPLAY_PREFIX[locale]}${parts.suffix}`;
}

export function normalizeInvoiceNumberSearchTerm(searchTerm: string): string {
  const trimmed = searchTerm.trim();
  if (!trimmed) {
    return trimmed;
  }

  const parts = splitInvoiceReference(trimmed);
  if (!parts) {
    return trimmed;
  }

  return `${INVOICE_DISPLAY_PREFIX.en}${parts.suffix}`;
}

export function getQuoteStatusDateLabel(
  locale: TranslationLocale,
  status: string,
  formattedDate: string | null
): string | null {
  if (!formattedDate) {
    return null;
  }

  const prefix = getMessage(locale, `statuses.quoteDatePrefix.${status}`)
    ?? translate(locale, 'statuses.quoteDatePrefix.fallback');

  return `${prefix} ${formattedDate}`;
}

export function getActivityBadgeLabel(locale: TranslationLocale, action: string): string {
  return getMessage(locale, `activity.badges.${action}`) ?? action;
}

export function getActivityHeadline(locale: TranslationLocale, action: string): string {
  return getMessage(locale, `activity.headlines.${action}`)
    ?? translate(locale, 'activity.fallbackHeadline');
}

export function formatActivityRelativeTime(locale: TranslationLocale, dateString?: string): string {
  if (!dateString) {
    return '--';
  }

  const timestamp = new Date(dateString).getTime();
  if (!Number.isFinite(timestamp)) {
    return '--';
  }

  const diffMs = Date.now() - timestamp;
  const minutes = Math.floor(diffMs / 60000);

  if (minutes < 1) {
    return translate(locale, 'activity.relative.justNow');
  }

  if (minutes < 60) {
    return translate(locale, 'activity.relative.minutesAgo', { count: minutes });
  }

  if (minutes < 1440) {
    return translate(locale, 'activity.relative.hoursAgo', { count: Math.floor(minutes / 60) });
  }

  if (minutes < 2880) {
    return translate(locale, 'activity.relative.yesterday');
  }

  return new Date(timestamp).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB', {
    month: 'short',
    day: 'numeric',
  });
}

export function formatExactTimestamp(locale: TranslationLocale, dateString?: string): string {
  if (!dateString) {
    return '';
  }

  const date = new Date(dateString);
  if (!Number.isFinite(date.getTime())) {
    return '';
  }

  return date.toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getDocumentEmailLanguage(locale: TranslationLocale): string {
  return locale === 'fr' ? 'fr' : 'en';
}