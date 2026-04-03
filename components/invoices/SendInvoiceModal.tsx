'use client';

import { useCallback, useState } from 'react';

import { Loader2Icon, MailIcon, X } from 'lucide-react';
import { toast } from 'sonner';

import { resolveTranslatedError } from '@/lib/i18n/messages';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Locale = 'en' | 'fr';

interface SendInvoiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  invoiceNumber: string;
  clientEmail: string | null | undefined;
  clientName?: string | null;
  companyName?: string | null;
  locale: Locale;
  onSent?: () => void;
}

const translations = {
  en: {
    title: 'Send invoice by email',
    description: 'Send this invoice as a PDF attachment and include online payment.',
    emailLabel: 'Client email',
    emailPlaceholder: 'client@example.com',
    subjectLabel: 'Subject',
    messageLabel: 'Message',
    cancel: 'Cancel',
    send: 'Send invoice',
    sending: 'Sending...',
    emailRequired: 'Client email is required',
    success: 'Invoice sent successfully',
    error: 'Failed to send invoice',
    defaultSubject: (invoiceNumber: string) => `Invoice ${invoiceNumber} - Payment details`,
    defaultMessage: (invoiceNumber: string, clientName?: string | null, senderCompany?: string | null) => {
      const greeting = clientName ? `Dear ${clientName},` : 'Hello,';
      const signOff = senderCompany ? `Best regards,\n${senderCompany}` : 'Best regards,';
      return `${greeting}\n\nPlease find attached your invoice ${invoiceNumber}.\n\nUse the secure payment button in this email to complete payment online.\n\nIf you have any questions about this invoice, feel free to reply to this email.\n\n${signOff}`;
    },
  },
  fr: {
    title: 'Envoyer la facture par e-mail',
    description: 'Envoyer cette facture en piece jointe PDF avec paiement en ligne.',
    emailLabel: 'E-mail du client',
    emailPlaceholder: 'client@exemple.com',
    subjectLabel: 'Objet',
    messageLabel: 'Message',
    cancel: 'Annuler',
    send: 'Envoyer la facture',
    sending: 'Envoi en cours...',
    emailRequired: 'L e-mail du client est requis',
    success: 'Facture envoyee avec succes',
    error: 'Impossible d envoyer la facture',
    defaultSubject: (invoiceNumber: string) => `Facture ${invoiceNumber} - Details de paiement`,
    defaultMessage: (invoiceNumber: string, clientName?: string | null, senderCompany?: string | null) => {
      const greeting = clientName ? `Bonjour ${clientName},` : 'Bonjour,';
      const signOff = senderCompany ? `Bien cordialement,\n${senderCompany}` : 'Bien cordialement,';
      return `${greeting}\n\nVeuillez trouver ci-joint votre facture ${invoiceNumber}.\n\nUtilisez le bouton de paiement securise dans cet e-mail pour regler en ligne.\n\nSi vous avez des questions sur cette facture, vous pouvez repondre a cet e-mail.\n\n${signOff}`;
    },
  },
};

export default function SendInvoiceModal({
  open,
  onOpenChange,
  invoiceId,
  invoiceNumber,
  clientEmail,
  clientName,
  companyName,
  locale,
  onSent,
}: SendInvoiceModalProps) {
  const t = translations[locale];

  const getInitialSubject = useCallback(() => t.defaultSubject(invoiceNumber), [t, invoiceNumber]);
  const getInitialMessage = useCallback(
    () => t.defaultMessage(invoiceNumber, clientName, companyName),
    [t, invoiceNumber, clientName, companyName]
  );

  const [email, setEmail] = useState(clientEmail || '');
  const [subject, setSubject] = useState(getInitialSubject);
  const [message, setMessage] = useState(getInitialMessage);
  const [sending, setSending] = useState(false);

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setEmail(clientEmail || '');
      setSubject(getInitialSubject());
      setMessage(getInitialMessage());
    }
    onOpenChange(nextOpen);
  };

  async function handleSend() {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      toast.error(t.emailRequired);
      return;
    }

    setSending(true);
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: trimmedEmail,
          subject: subject.trim(),
          message: message.trim(),
          locale,
        }),
      });

      const payload = (await response.json()) as { success?: boolean; message?: string };
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || t.error);
      }

      toast.success(t.success);
      onSent?.();
      onOpenChange(false);
    } catch (error) {
      toast.error(resolveTranslatedError(locale, error, t.error));
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex w-[calc(100vw-1rem)] max-w-md max-h-[calc(100dvh-1rem-var(--app-safe-area-top)-var(--app-safe-area-bottom))] flex-col gap-2.5 scroll-pb-24 p-3.5 pb-3.5 [&_button[data-slot=button]]:focus-visible:ring-inset [&_input[data-slot=input]]:focus-visible:ring-inset [&_textarea]:focus-visible:ring-inset [&_textarea]:focus-visible:ring-offset-0 sm:max-h-[calc(100dvh-2rem-var(--app-safe-area-top)-var(--app-safe-area-bottom))] sm:p-4 sm:pb-4">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="absolute top-3 right-3"
          aria-label={t.cancel}
          onClick={() => onOpenChange(false)}
          disabled={sending}
        >
          <X className="size-4" />
        </Button>

        <DialogHeader className="gap-1 pr-8">
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <MailIcon className="size-4" />
            {t.title}
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">{t.description}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1 text-sm">
          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="send-invoice-email" className="text-xs">{t.emailLabel}</Label>
              <Input
                id="send-invoice-email"
                type="email"
                className="h-9 text-sm"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={t.emailPlaceholder}
                disabled={sending}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="send-invoice-subject" className="text-xs">{t.subjectLabel}</Label>
              <Input
                id="send-invoice-subject"
                type="text"
                className="h-9 text-sm"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                disabled={sending}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="send-invoice-message" className="text-xs">{t.messageLabel}</Label>
            <textarea
              id="send-invoice-message"
              className="flex min-h-28 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              disabled={sending}
            />
          </div>

          <p className="text-xs text-muted-foreground">{invoiceNumber}</p>
        </div>

        <DialogFooter className="border-t pt-3">
          <Button type="button" variant="outline" className="h-10 text-sm sm:h-9" onClick={() => onOpenChange(false)} disabled={sending}>
            {t.cancel}
          </Button>
          <Button type="button" className="h-10 text-sm sm:h-9" onClick={handleSend} disabled={sending}>
            {sending ? <Loader2Icon className="size-4 animate-spin" /> : null}
            {sending ? t.sending : t.send}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
