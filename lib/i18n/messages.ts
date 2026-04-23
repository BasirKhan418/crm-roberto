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
      on: 'On',
      off: 'Off',
      loading: 'Loading...',
    },
    payment: {
      linkFailed: 'Could not create payment link',
      redirecting: 'Redirecting to payment...',
    },
    dashboard: {
      collection: {
        title: 'Collection',
        loadFailed: 'Failed to load collection KPIs.',
        noReminder: 'No reminder',
        pausedFlows: '{count} paused reminder flow(s)',
        overdueDeadline: '{count} invoice(s) past formal notice deadline — action required',
      },
      recurrences: {
        title: 'Upcoming recurrences',
        loadFailed: 'Failed to load upcoming recurrences.',
        empty: 'No recurrences due in the next 14 days',
        dueIn: 'due in {days} days',
        generate: 'Generate',
        generateSuccess: 'Recurrence generated successfully',
        generateFailed: 'Failed to generate recurrence invoice',
      },
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
      recurrenceNextOccurrenceRequired: 'Next occurrence is required',
      recurrenceNextOccurrenceInvalid: 'Next occurrence must be a valid date',
      recurrenceEndDateInvalid: 'Repeat until must be a valid date',
      recurrenceEndDateBeforeNextOccurrence: 'Repeat until must be on or after the next occurrence',
      recurrenceCustomIntervalRequired: 'Custom interval must be at least 1 day',
      recurrenceCustomIntervalOnlyForCustom: 'Custom interval is only allowed when frequency is custom',
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
        quote_sent: 'Sent',
        quote_client_replied: 'Client replied',
        quote_status_changed: 'Status changed',
        invoice_created: 'Created',
        invoice_reminder_sent: 'Reminder sent',
        invoice_reminder_failed: 'Reminder failed',
        invoice_reminder_skipped: 'Reminder skipped',
        invoice_reminder_paused: 'Reminder paused',
        invoice_reminder_resumed: 'Reminder resumed',
        invoice_formal_notice_sent: 'Formal notice sent',
        invoice_legal_recovery_initiated: 'Legal recovery initiated',
        invoice_recurrence_created: 'Recurrence created',
        invoice_recurrence_stopped: 'Recurrence stopped',
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
        quote_sent: 'Quote sent',
        quote_client_replied: 'Client replied',
        quote_status_changed: 'Quote status updated',
        quote_status: {
          draft: 'Quote moved to draft',
          sent: 'Quote sent',
          accepted: 'Quote accepted',
          rejected: 'Quote declined',
          expired: 'Quote expired',
          cancelled: 'Quote cancelled',
        },
        invoice_created: 'Invoice created',
        invoice_reminder_sent: 'Reminder sent',
        invoice_reminder_failed: 'Reminder failed',
        invoice_reminder_skipped: 'Reminder skipped',
        invoice_reminder_paused: 'Reminders paused',
        invoice_reminder_resumed: 'Reminders resumed',
        invoice_formal_notice_sent: 'Formal notice sent',
        invoice_legal_recovery_initiated: 'Legal recovery initiated',
        invoice_recurrence_created: 'Recurring invoice enabled',
        invoice_recurrence_stopped: 'Recurring invoice stopped',
        invoice_recurrence_generated: 'Recurring invoice generated',
        invoice_recurrence_due: 'Recurring invoice due',
        invoice_payment_received: 'Payment received',
        invoice_payment_updated: 'Payment updated',
        invoice_payment_deleted: 'Payment deleted',
      },
      relative: {
        justNow: 'Just now',
        minutesAgo: '{count}m ago',
        hoursAgo: '{count}h ago',
        yesterday: 'Yesterday',
      },
      moreItems: '+{count} more items',
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
        messageBodyFull: 'We confirm that your payment has been received successfully. This invoice is now fully paid.',
        messageBodyPartial: 'We confirm that your payment has been received successfully. Your updated payment summary is included below.',
        amountPaid: 'Amount paid',
        paymentType: 'Payment type',
        method: 'Method',
        paidAt: 'Paid at',
        invoiceTotal: 'Invoice total',
        totalPaid: 'Total paid',
        remainingAmount: 'Remaining balance',
        textBody:
          'Hello {name},\n\nPayment received for invoice {invoiceNumber}.\nAmount: {amount}\nType: {paymentType}\nMethod: {paymentMethod}\nPaid at: {paidAt}\nInvoice total: {invoiceTotal}\nTotal paid: {totalPaid}\nRemaining balance: {remainingAmount}',
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
        legalRecovery: 'Legal Recovery',
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
        language: {
          label: 'Reminder language',
          auto: 'Use request/profile locale',
          english: 'English',
          french: 'French',
          help: 'Pick a fixed language for reminders, or auto to follow current request/profile locale.',
        },
        templatesSectionDescription: 'Adjust the email your customer receives for each reminder step.',
        templates: {
          cardDescription: 'Customer and invoice details are added automatically when the email is sent.',
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
          description: 'Set optional late fee rules for each reminder stage.',
          enable: 'Enable late fees',
          enableHelp: 'When enabled, late fees are included in reminder context.',
          stageHelp: 'Configure each reminder stage independently. Disabled stages add no penalty.',
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
        legalRecoverySection: {
          title: 'Legal Recovery',
          description: 'Configure the payment-order procedure (Justice of the Peace) used to generate the complete recovery file, including the confirmation flow required before the formal notice deadline.',
          scopeTitle: 'Current scope',
          scopeLine1: '→ Payment order procedure (Ordonnance de paiement)',
          scopeLine2: '→ Claims below €15,000',
          scopeLine3: '→ Justice of the Peace only',
          scopeNote: 'Claims above €15,000 (district court / ordonnance de provision / référé) will be handled in a future phase.',
          jurisdictionLabel: 'Jurisdiction',
          jurisdictionJusticeOfPeace: 'Justice of the Peace',
          claimThresholdLabel: 'Claim threshold (EUR)',
          claimThresholdHelp: 'Maximum amount eligible for this procedure. Default €15,000.',
          courtLocationLabel: 'Justice of the Peace location',
          courtLocationHelp: 'Choose which Justice of the Peace will handle the request (Luxembourg, Esch-sur-Alzette or Diekirch).',
          courtLocationNone: 'Not selected',
          courtLocationLuxembourg: 'Luxembourg',
          courtLocationEschSurAlzette: 'Esch-sur-Alzette',
          courtLocationDiekirch: 'Diekirch',
          courtNameLabel: 'Court name',
          courtNamePlaceholder: 'Justice of the Peace of …',
          courtAddressLabel: 'Court address (optional)',
          courtCityLabel: 'Court city (optional)',
          creditorProfessionLabel: 'Profession (optional)',
          creditorProfessionPlaceholder: 'Artisan, merchant, independent professional, …',
          elisantDomicileLabel: 'Electing domicile at (optional)',
          elisantDomicilePlaceholder: 'Law firm name and address, if applicable',
          representativeNameLabel: 'Representative name',
          representativeNamePlaceholder: 'Name of the person filing the request',
          representativeTitleLabel: 'Representative title (optional)',
          additionalNotesLabel: 'Additional legal notes (optional)',
          additionalNotesPlaceholder: 'Any extra clause to include in the payment-order request.',
          saveButton: 'Save legal recovery',
          savedToast: 'Legal recovery settings saved',
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
        sendAgain: 'Send reminder again',
        resendFormalNotice: 'Resend (exceptional)',
        pause: 'Pause reminders',
        resume: 'Resume reminders',
        downloadNotice: 'Download legal notice',
        skipNext: 'Skip next reminder',
        downloadPaymentOrder: 'Download payment-order request',
        downloadRecoveryFile: 'Download recovery file (ZIP)',
        openSettings: 'Open settings',
      },
      formalNoticeResendConfirm: {
        title: 'Resend formal notice?',
        description: 'A formal notice was already sent on {date}. This is a legal action. Do you really want to send it again?',
        confirm: 'Resend formal notice',
        cancel: 'Cancel',
      },
      legalRecovery: {
        sectionTitle: 'Legal recovery',
        sectionDescription: 'Generate a payment-order request and the complete recovery file for the Justice of the Peace. If the formal notice deadline has not passed yet, confirmation is required before proceeding.',
        scopeNote: 'Scope: claims below €15,000, Justice of the Peace only. District-court procedures will be handled in a future phase.',
        eligibleDescription: 'The formal notice deadline has passed — you can generate the payment-order request and download the complete recovery file.',
        availableOnlyIfTitle: 'Available only if:',
        availableOnlyIfFormalNotice: '→ Formal notice has been sent',
        formalNoticeRequiredMessage: 'Please send a formal notice before initiating legal proceedings.',
        warning: {
          formal_notice_deadline_not_reached: 'The formal notice legal deadline is {date}. You can still proceed now, but confirmation is required before generating the legal recovery documents.',
        },
        deadlineOverrideConfirm: {
          title: 'Proceed before the formal notice deadline?',
          description: 'The formal notice legal deadline is {date}. You are about to continue with {document}. Do you want to proceed anyway?',
          confirm: 'Proceed anyway',
          cancel: 'Cancel',
        },
        initiatedOn: 'Recovery procedure initiated on {date}',
        claimAmount: 'Claim amount: {amount}',
        thresholdHint: 'Eligibility threshold: {amount}',
        ineligible: {
          formal_notice_not_sent: 'Please send a formal notice before initiating legal proceedings.',
          formal_notice_deadline_not_reached: 'Wait for the formal notice legal deadline ({date}) to pass before initiating legal recovery.',
          amount_exceeds_threshold: 'Claim amount {amount} exceeds the €{threshold} threshold. This payment-order procedure before the Justice of the Peace is not applicable to this case.',
          invoice_paid: 'This invoice is already paid.',
          amount_is_zero: 'There is no outstanding amount on this invoice.',
        },
        configureCourt: 'Court details are not configured. Add them in Settings → Reminders → Legal Recovery before generating the request.',
        downloadPaymentOrderSuccess: 'Payment-order request downloaded',
        downloadRecoveryFileSuccess: 'Recovery file downloaded',
        downloadFailed: 'Failed to download legal recovery document',
      },
      simpleStatus: {
        active: 'Active',
        inactive: 'Inactive',
        disable: 'Disable',
        enable: 'Enable',
        disableSuccess: 'Reminders disabled',
        enableSuccess: 'Reminders enabled',
        disabledDescription: 'Automatic reminders are disabled for this invoice.',
      },
      history: {
        title: 'Reminder history',
        pausedLine: 'Reminders paused at level {level}',
        resumedLine: 'Reminders resumed at level {level}',
        skippedLine: 'Reminder {level} skipped',
        failedLine: 'Reminder {level} failed to send',
      },
      nextScheduled: 'Next reminder in {days} days',
      reminderSent: 'Reminder {level} sent on {date}',
      formalNoticeSent: 'Formal notice sent on {date}',
      noReminderSent: 'No reminder sent yet',
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
          paused: 'paused',
          resumed: 'resumed',
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
          preview: 'Live preview',
          previewHint: 'Preview reflects the computed late fees and values the client will actually see.',
          lateFeeBadgeFixed: '+{amount}',
          lateFeeBadgePercent: '+{value}%',
          lateFeeDisabled: 'No late fee',
          lateFeeNotConfigured: 'Late fees are not configured for this reminder level. The email will be sent without any penalty.',
          lateFeeSummary: 'Late fee added at this level: {amount}',
          lateFeeSummaryZero: 'No late fee applies at this level.',
          amountWithFees: 'Total to be displayed to the client: {amount}',
          paymentLinkPlaceholder: '(generated when the email is sent)',
          paymentLinkNotAvailable: '(Stripe is not connected — the payment link will be empty)',
          legalDeadlinePreview: 'Legal deadline (computed on send): {date}',
          formalNoticeRequiresOverdue: 'A formal notice can only be sent once the invoice is overdue.',
          formalNoticeLockedShort: 'Available once overdue',
          formalNoticeNotOverdueWarning: 'Invoice not yet overdue ({days} days remaining). You can still send the formal notice, but it is usually reserved for overdue invoices.',
          formalNoticeNotOverdueShort: 'Not yet overdue',
          formalNoticeConfirmTitle: 'Send formal notice anyway?',
          formalNoticeConfirmDescription: 'This invoice is not yet overdue ({days} days remaining). A formal notice (mise en demeure) is usually reserved for overdue invoices. Do you still want to send it now?',
          formalNoticeConfirmSend: 'Send formal notice',
          formalNoticeConfirmCancel: 'Cancel',
          configureLateFees: 'Configure late fees',
          templateMissingTitle: 'No template found for this level',
          templateMissingBody: 'Using the default template. You can customize it in Settings → Reminders.',
          reloadTemplate: 'Reset to template',
          loadingTemplates: 'Loading templates...',
          subjectRequired: 'Subject is required',
          bodyRequired: 'Body is required',
          emptyValue: '(empty)',
        },
      },
    },
    recurring: {
      card: {
        title: 'Recurrence',
        empty: 'Set up recurrence so this invoice repeats automatically on a schedule.',
        manualValidationNotice: 'Auto-send is off. Generated invoices will stay in draft until you review and send them manually.',
      },
      status: {
        active: 'Active',
        inactive: 'Inactive',
        customTemplate: 'Custom template',
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
        edit: 'Edit settings',
        disable: 'Disable',
      },
      setup: {
        title: 'Set up recurrence',
        description: 'Configure how and when this invoice should repeat. You can also define a different template for future invoices.',
        scheduleSection: 'Schedule',
        scheduleSectionHelp: 'Choose the cadence and when the next invoice should be issued.',
        automationSection: 'Automation',
        automationSectionHelp: 'Decide what happens when an occurrence becomes due.',
        templateSection: 'Use a different template for future invoices',
        templateSectionHelp: 'When enabled, future recurring invoices will use the items and amounts defined here instead of copying the original invoice.',
        templateFallbackHelp: 'Future invoices will be generated with the same items, prices, and notes as the current invoice.',
        templateLineItems: 'Products / Services for future recurrences',
        templateDeposit: 'Deposit percentage (%)',
        templateNotes: 'Notes',
        templateNotesPlaceholder: 'Notes included on each recurring invoice...',
        templateNoItems: 'Add at least one line item in the template.',
        templateInvalidItem: 'Each template line item must have a name.',
        manualValidationNotice: 'Auto-send is off. Generated invoices will wait for your manual validation before being sent.',
        frequency: 'Frequency',
        customIntervalDays: 'Custom interval (days)',
        repeatUntilOptional: 'Repeat until (optional)',
        autoGenerateHelp: 'When enabled, the next invoice is generated automatically.',
        autoSendHelp: 'Only available when auto-generate is enabled. Off by default so you can review before sending.',
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
      stoppedOn: 'Stopped on {date}',
      restart: 'Restart recurrence',
      lastGeneratedInvoice: 'Open generated invoice',
      stopDialog: {
        title: 'Disable recurrence?',
        description: 'This stops future automatic generation for this invoice.',
        reasonPlaceholder: 'Add an optional reason...',
        cancel: 'Cancel',
        confirm: 'Disable recurrence',
      },
      autoGenerate: 'Auto-generate next invoice',
      autoSend: 'Auto-send to client',
      nextOccurrence: 'Next occurrence',
      nextOccurrenceLabel: 'Next invoice on {date}',
      lastGenerated: 'Last generated',
    },
    invoices: {
      tabs: {
        payments: 'Payments',
      },
      sections: {
        payments: 'Payments',
        paymentsDescription: 'Track payments received and record new ones.',
        recurrence: 'Recurrence',
        recurrenceDescription: 'Automate future invoices on a schedule.',
        reminders: 'Reminders',
        remindersDescription: 'Follow up with your client when the invoice is overdue.',
        summary: 'Summary',
        summaryDescription: 'Global totals for this invoice at a glance.',
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
      on: 'Activé',
      off: 'Désactivé',
      loading: 'Chargement...',
    },
    payment: {
      linkFailed: 'Impossible de créer le lien de paiement',
      redirecting: 'Redirection vers le paiement...',
    },
    dashboard: {
      collection: {
        title: 'Recouvrement',
        loadFailed: 'Impossible de charger les indicateurs de recouvrement.',
        noReminder: 'Sans relance',
        pausedFlows: '{count} flux de relance en pause',
        overdueDeadline: '{count} facture(s) dépassant l\'échéance de mise en demeure — action requise',
      },
      recurrences: {
        title: 'Prochaines récurrences',
        loadFailed: 'Impossible de charger les prochaines récurrences.',
        empty: 'Aucune récurrence prévue dans les 14 prochains jours',
        dueIn: 'dans {days} jours',
        generate: 'Générer',
        generateSuccess: 'Récurrence générée avec succès',
        generateFailed: 'Impossible de générer la facture récurrente',
      },
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
      recurrenceNextOccurrenceRequired: 'La prochaine occurrence est requise',
      recurrenceNextOccurrenceInvalid: 'La prochaine occurrence doit être une date valide',
      recurrenceEndDateInvalid: 'La date de fin doit être une date valide',
      recurrenceEndDateBeforeNextOccurrence: 'La date de fin doit être égale ou postérieure à la prochaine occurrence',
      recurrenceCustomIntervalRequired: 'L\'intervalle personnalisé doit être d\'au moins 1 jour',
      recurrenceCustomIntervalOnlyForCustom: 'L\'intervalle personnalisé est autorisé uniquement pour la fréquence personnalisée',
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
        quote_sent: 'Envoyé',
        quote_client_replied: 'Le client a répondu',
        quote_status_changed: 'Statut modifié',
        invoice_created: 'Créée',
        invoice_reminder_sent: 'Relance envoyée',
        invoice_reminder_failed: 'Échec relance',
        invoice_reminder_skipped: 'Relance ignorée',
        invoice_reminder_paused: 'Relance mise en pause',
        invoice_reminder_resumed: 'Relance reprise',
        invoice_formal_notice_sent: 'Mise en demeure envoyée',
        invoice_legal_recovery_initiated: 'Procédure de recouvrement lancée',
        invoice_recurrence_created: 'Récurrence créée',
        invoice_recurrence_stopped: 'Récurrence arrêtée',
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
        quote_sent: 'Devis envoyé',
        quote_client_replied: 'Le client a répondu',
        quote_status_changed: 'Statut du devis mis à jour',
        quote_status: {
          draft: 'Devis remis en brouillon',
          sent: 'Devis envoyé',
          accepted: 'Devis accepté',
          rejected: 'Devis refusé',
          expired: 'Devis expiré',
          cancelled: 'Devis annulé',
        },
        invoice_created: 'Facture créée',
        invoice_reminder_sent: 'Relance envoyée',
        invoice_reminder_failed: 'Échec de la relance',
        invoice_reminder_skipped: 'Relance ignorée',
        invoice_reminder_paused: 'Relances mises en pause',
        invoice_reminder_resumed: 'Relances reprises',
        invoice_formal_notice_sent: 'Mise en demeure envoyée',
        invoice_legal_recovery_initiated: 'Procédure de recouvrement lancée',
        invoice_recurrence_created: 'Facture récurrente activée',
        invoice_recurrence_stopped: 'Facture récurrente arrêtée',
        invoice_recurrence_generated: 'Facture récurrente générée',
        invoice_recurrence_due: 'Facture récurrente à échéance',
        invoice_payment_received: 'Paiement reçu',
        invoice_payment_updated: 'Paiement modifié',
        invoice_payment_deleted: 'Paiement supprimé',
      },
      relative: {
        justNow: "À l'instant",
        minutesAgo: 'Il y a {count} min',
        hoursAgo: 'Il y a {count} h',
        yesterday: 'Hier',
      },
      moreItems: '+{count} élément(s) supplémentaire(s)',
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
        messageBodyFull: 'Nous confirmons que votre paiement a été reçu avec succès. Cette facture est désormais entièrement réglée.',
        messageBodyPartial: 'Nous confirmons que votre paiement a été reçu avec succès. Votre récapitulatif de paiement mis à jour figure ci-dessous.',
        amountPaid: 'Montant réglé',
        paymentType: 'Type de paiement',
        method: 'Méthode',
        paidAt: 'Payé le',
        invoiceTotal: 'Montant total de la facture',
        totalPaid: 'Total payé',
        remainingAmount: 'Solde restant',
        textBody:
          'Bonjour {name},\n\nPaiement reçu pour la facture {invoiceNumber}.\nMontant : {amount}\nType : {paymentType}\nMéthode : {paymentMethod}\nPayé le : {paidAt}\nMontant total : {invoiceTotal}\nTotal payé : {totalPaid}\nSolde restant : {remainingAmount}',
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
        legalRecovery: 'Recouvrement judiciaire',
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
        language: {
          label: 'Langue des relances',
          auto: 'Utiliser la langue de la requête/profil',
          english: 'Anglais',
          french: 'Français',
          help: 'Choisissez une langue fixe pour les relances, ou auto pour suivre la langue de la requête/profil.',
        },
        templatesSectionDescription: 'Ajustez l\'e-mail que votre client reçoit pour chaque étape de relance.',
        templates: {
          cardDescription: 'Les détails client et facture sont ajoutés automatiquement lors de l\'envoi.',
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
          description: 'Définissez les pénalités de retard pour chaque étape de relance.',
          enable: 'Activer les pénalités de retard',
          enableHelp: 'Quand activé, les pénalités sont incluses dans le contexte des relances.',
          stageHelp: 'Configurez chaque étape de relance indépendamment. Les étapes désactivées n’ajoutent aucune pénalité.',
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
        legalRecoverySection: {
          title: 'Recouvrement judiciaire',
          description: 'Configurez la procédure d\'ordonnance de paiement (Justice de Paix) utilisée pour générer le dossier complet de recouvrement, y compris la confirmation requise avant l\'expiration du délai de mise en demeure.',
          scopeTitle: 'Périmètre actuel',
          scopeLine1: '→ Procédure d\'ordonnance de paiement',
          scopeLine2: '→ Créances inférieures à 15 000 €',
          scopeLine3: '→ Justice de Paix uniquement',
          scopeNote: 'Les créances supérieures à 15 000 € (tribunal d\'arrondissement / ordonnance de provision / référé) seront traitées dans une phase ultérieure.',
          jurisdictionLabel: 'Juridiction',
          jurisdictionJusticeOfPeace: 'Justice de Paix',
          claimThresholdLabel: 'Seuil de créance (EUR)',
          claimThresholdHelp: 'Montant maximum éligible à cette procédure. 15 000 € par défaut.',
          courtLocationLabel: 'Justice de Paix de',
          courtLocationHelp: 'Choisissez la Justice de Paix qui traitera la requête (Luxembourg, Esch-sur-Alzette ou Diekirch).',
          courtLocationNone: 'Non définie',
          courtLocationLuxembourg: 'Luxembourg',
          courtLocationEschSurAlzette: 'Esch-sur-Alzette',
          courtLocationDiekirch: 'Diekirch',
          courtNameLabel: 'Nom de la juridiction',
          courtNamePlaceholder: 'Justice de Paix de …',
          courtAddressLabel: 'Adresse du tribunal (optionnel)',
          courtCityLabel: 'Ville du tribunal (optionnel)',
          creditorProfessionLabel: 'Profession (optionnel)',
          creditorProfessionPlaceholder: 'Artisan, commerçant, profession libérale, …',
          elisantDomicileLabel: 'Élisant domicile en l\'étude de (optionnel)',
          elisantDomicilePlaceholder: 'Nom et adresse de l\'étude, le cas échéant',
          representativeNameLabel: 'Nom du représentant',
          representativeNamePlaceholder: 'Personne déposant la requête',
          representativeTitleLabel: 'Qualité du représentant (optionnel)',
          additionalNotesLabel: 'Mentions légales additionnelles (optionnel)',
          additionalNotesPlaceholder: 'Clauses supplémentaires à inclure dans la requête en paiement.',
          saveButton: 'Enregistrer le recouvrement judiciaire',
          savedToast: 'Paramètres de recouvrement judiciaire enregistrés',
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
        sendAgain: 'Envoyer à nouveau',
        resendFormalNotice: 'Renvoyer (exceptionnel)',
        pause: 'Mettre en pause',
        resume: 'Reprendre',
        downloadNotice: 'Télécharger la mise en demeure',
        skipNext: 'Ignorer le prochain rappel',
        downloadPaymentOrder: 'Télécharger la requête en paiement',
        openSettings: 'Ouvrir les paramètres',
        downloadRecoveryFile: 'Télécharger le dossier de recouvrement (ZIP)',
      },
      formalNoticeResendConfirm: {
        title: 'Renvoyer la mise en demeure ?',
        description: 'Une mise en demeure a déjà été envoyée le {date}. Il s\'agit d\'une action légale. Voulez-vous vraiment la renvoyer ?',
        confirm: 'Renvoyer la mise en demeure',
        cancel: 'Annuler',
      },
      legalRecovery: {
        sectionTitle: 'Recouvrement judiciaire',
        sectionDescription: 'Générez la requête en paiement et le dossier complet de recouvrement pour la Justice de Paix. Si le délai de mise en demeure n\'est pas encore expiré, une confirmation sera demandée avant de poursuivre.',
        scopeNote: 'Périmètre : créances inférieures à 15 000 €, Justice de Paix uniquement. Les procédures du tribunal d\'arrondissement seront traitées dans une phase ultérieure.',
        eligibleDescription: 'Le délai de la mise en demeure est dépassé — vous pouvez générer la requête en paiement et télécharger le dossier complet de recouvrement.',
        availableOnlyIfTitle: 'Disponible uniquement si :',
        availableOnlyIfFormalNotice: '→ La mise en demeure a été envoyée',
        formalNoticeRequiredMessage: 'Veuillez envoyer une mise en demeure avant d\'engager une procédure judiciaire.',
        warning: {
          formal_notice_deadline_not_reached: 'Le délai légal de la mise en demeure expire le {date}. Vous pouvez tout de même continuer maintenant, mais une confirmation est requise avant de générer les documents de recouvrement.',
        },
        deadlineOverrideConfirm: {
          title: 'Continuer avant l\'expiration du délai de mise en demeure ?',
          description: 'Le délai légal de la mise en demeure expire le {date}. Vous êtes sur le point de continuer avec {document}. Voulez-vous poursuivre malgré tout ?',
          confirm: 'Poursuivre quand même',
          cancel: 'Annuler',
        },
        initiatedOn: 'Procédure de recouvrement lancée le {date}',
        claimAmount: 'Montant réclamé : {amount}',
        thresholdHint: 'Seuil d\'éligibilité : {amount}',
        ineligible: {
          formal_notice_not_sent: 'Veuillez envoyer une mise en demeure avant d\'engager une procédure judiciaire.',
          formal_notice_deadline_not_reached: 'Attendez l\'expiration du délai légal de la mise en demeure ({date}) avant d\'engager le recouvrement judiciaire.',
          amount_exceeds_threshold: 'Le montant réclamé {amount} dépasse le seuil de {threshold} €. Cette procédure d\'ordonnance de paiement devant la Justice de Paix ne s\'applique pas à ce dossier.',
          invoice_paid: 'Cette facture est déjà réglée.',
          amount_is_zero: 'Il n\'y a aucun montant restant dû sur cette facture.',
        },
        configureCourt: 'Les coordonnées de la juridiction ne sont pas configurées. Renseignez-les dans Paramètres → Relances → Recouvrement judiciaire avant de générer la requête.',
        downloadPaymentOrderSuccess: 'Requête en paiement téléchargée',
        downloadRecoveryFileSuccess: 'Dossier de recouvrement téléchargé',
        downloadFailed: 'Impossible de télécharger le document de recouvrement',
      },
      simpleStatus: {
        active: 'Actif',
        inactive: 'Inactif',
        disable: 'Désactiver',
        enable: 'Activer',
        disableSuccess: 'Relances désactivées',
        enableSuccess: 'Relances activées',
        disabledDescription: 'Les relances automatiques sont désactivées pour cette facture.',
      },
      history: {
        title: 'Historique des relances',
        pausedLine: 'Relances mises en pause au niveau {level}',
        resumedLine: 'Relances reprises au niveau {level}',
        skippedLine: 'Relance {level} ignorée',
        failedLine: 'Échec d\'envoi de la relance {level}',
      },
      nextScheduled: 'Prochain rappel dans {days} jours',
      reminderSent: 'Rappel {level} envoyé le {date}',
      formalNoticeSent: 'Mise en demeure envoyée le {date}',
      noReminderSent: 'Aucun rappel envoyé pour le moment',
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
          paused: 'mis en pause',
          resumed: 'repris',
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
          preview: 'Aperçu en direct',
          previewHint: 'L\'aperçu reflète les pénalités calculées et les valeurs que le client verra réellement.',
          lateFeeBadgeFixed: '+{amount}',
          lateFeeBadgePercent: '+{value} %',
          lateFeeDisabled: 'Aucune pénalité',
          lateFeeNotConfigured: 'Les pénalités de retard ne sont pas configurées pour ce niveau. L\'e-mail sera envoyé sans pénalité.',
          lateFeeSummary: 'Pénalité ajoutée à ce niveau : {amount}',
          lateFeeSummaryZero: 'Aucune pénalité n\'est appliquée à ce niveau.',
          amountWithFees: 'Total affiché au client : {amount}',
          paymentLinkPlaceholder: '(généré lors de l\'envoi de l\'e-mail)',
          paymentLinkNotAvailable: '(Stripe n\'est pas connecté — le lien de paiement sera vide)',
          legalDeadlinePreview: 'Date limite légale (calculée à l\'envoi) : {date}',
          formalNoticeRequiresOverdue: 'Une mise en demeure ne peut être envoyée que si la facture est en retard.',
          formalNoticeLockedShort: 'Disponible une fois en retard',
          formalNoticeNotOverdueWarning: 'Facture pas encore en retard ({days} jours restants). Vous pouvez tout de même envoyer la mise en demeure, mais elle est généralement réservée aux factures en retard.',
          formalNoticeNotOverdueShort: 'Pas encore en retard',
          formalNoticeConfirmTitle: 'Envoyer la mise en demeure quand même ?',
          formalNoticeConfirmDescription: 'Cette facture n\'est pas encore en retard ({days} jours restants). Une mise en demeure est généralement réservée aux factures en retard. Voulez-vous vraiment l\'envoyer maintenant ?',
          formalNoticeConfirmSend: 'Envoyer la mise en demeure',
          formalNoticeConfirmCancel: 'Annuler',
          configureLateFees: 'Configurer les pénalités',
          templateMissingTitle: 'Aucun modèle trouvé pour ce niveau',
          templateMissingBody: 'Utilisation du modèle par défaut. Vous pouvez le personnaliser dans Paramètres → Relances.',
          reloadTemplate: 'Réinitialiser au modèle',
          loadingTemplates: 'Chargement des modèles...',
          subjectRequired: 'Le sujet est obligatoire',
          bodyRequired: 'Le corps est obligatoire',
          emptyValue: '(vide)',
        },
      },
    },
    recurring: {
      card: {
        title: 'Récurrence',
        empty: 'Configurez une récurrence pour que cette facture se répète automatiquement.',
        manualValidationNotice: 'L\'envoi automatique est désactivé. Les factures générées resteront en brouillon jusqu\'à ce que vous les envoyiez manuellement.',
      },
      status: {
        active: 'Active',
        inactive: 'Inactive',
        customTemplate: 'Modèle personnalisé',
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
        edit: 'Modifier',
        disable: 'Désactiver',
      },
      setup: {
        title: 'Configurer la récurrence',
        description: 'Définissez comment et quand cette facture doit se répéter. Vous pouvez aussi définir un modèle différent pour les prochaines factures.',
        scheduleSection: 'Planification',
        scheduleSectionHelp: 'Choisissez la fréquence et la date de la prochaine facture.',
        automationSection: 'Automatisation',
        automationSectionHelp: 'Décidez ce qui doit se passer quand une échéance arrive.',
        templateSection: 'Utiliser un modèle différent pour les prochaines factures',
        templateSectionHelp: 'Quand activé, les prochaines factures récurrentes utiliseront les lignes et montants définis ici au lieu de copier la facture d\'origine.',
        templateFallbackHelp: 'Les prochaines factures utiliseront les mêmes lignes, prix et notes que la facture actuelle.',
        templateLineItems: 'Produits / Services des prochaines récurrences',
        templateDeposit: 'Pourcentage d\'acompte (%)',
        templateNotes: 'Notes',
        templateNotesPlaceholder: 'Notes ajoutées sur chaque facture récurrente...',
        templateNoItems: 'Ajoutez au moins une ligne dans le modèle.',
        templateInvalidItem: 'Chaque ligne du modèle doit avoir un nom.',
        manualValidationNotice: 'L\'envoi automatique est désactivé. Les factures générées attendront votre validation manuelle avant d\'être envoyées.',
        frequency: 'Fréquence',
        customIntervalDays: 'Intervalle personnalisé (jours)',
        repeatUntilOptional: 'Répéter jusqu\'au (optionnel)',
        autoGenerateHelp: 'Quand activé, la prochaine facture est générée automatiquement.',
        autoSendHelp: 'Disponible uniquement si la génération auto est activée. Désactivé par défaut pour permettre une validation avant envoi.',
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
      stoppedOn: 'Arrêtée le {date}',
      restart: 'Redémarrer la récurrence',
      lastGeneratedInvoice: 'Ouvrir la facture générée',
      stopDialog: {
        title: 'Désactiver la récurrence ?',
        description: 'Cela arrête les prochaines générations automatiques pour cette facture.',
        reasonPlaceholder: 'Ajoutez une raison optionnelle...',
        cancel: 'Annuler',
        confirm: 'Désactiver la récurrence',
      },
      autoGenerate: 'Générer automatiquement',
      autoSend: 'Envoyer automatiquement au client',
      nextOccurrence: 'Prochaine échéance',
      nextOccurrenceLabel: 'Prochaine facture le {date}',
      lastGenerated: 'Dernière génération',
    },
    invoices: {
      tabs: {
        payments: 'Paiements',
      },
      sections: {
        payments: 'Paiements',
        paymentsDescription: 'Suivez les paiements reçus et enregistrez-en de nouveaux.',
        recurrence: 'Récurrence',
        recurrenceDescription: 'Automatisez les prochaines factures selon une fréquence.',
        reminders: 'Relances',
        remindersDescription: 'Relancez votre client lorsque la facture est en retard.',
        summary: 'Synthèse',
        summaryDescription: 'Vue d\'ensemble des totaux de la facture.',
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

const LOCALE_INVOICE_DISPLAY_PREFIX: Record<TranslationLocale, string> = {
  fr: 'FAC',
  en: 'INV',
};
const INVOICE_REFERENCE_PREFIXES = new Set(['INV', 'FAC']);

function splitInvoiceReference(invoiceNumber: string): { prefix: string; suffix: string } | null {
  const trimmed = invoiceNumber.trim();
  const separatorIndex = trimmed.indexOf('-');

  if (separatorIndex <= 0) {
    return null;
  }

  const prefix = trimmed.slice(0, separatorIndex).toUpperCase();
  if (!INVOICE_REFERENCE_PREFIXES.has(prefix)) {
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

  return `${LOCALE_INVOICE_DISPLAY_PREFIX[locale] ?? 'FAC'}${parts.suffix}`;
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

  return `${'FAC'}${parts.suffix}`;
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

export function getActivityHeadline(
  locale: TranslationLocale,
  action: string,
  metadata?: Record<string, unknown> | null
): string {
  if (action === 'quote_status_changed' && metadata) {
    const to = typeof metadata.to === 'string' ? metadata.to : null;
    if (to) {
      const specific = getMessage(locale, `activity.headlines.quote_status.${to}`);
      if (specific) {
        return specific;
      }
    }
  }

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