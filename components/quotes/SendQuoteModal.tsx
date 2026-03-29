'use client';

import { useState } from 'react';

import { Loader2Icon, SendIcon } from 'lucide-react';
import { toast } from 'sonner';

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

interface SendQuoteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quoteId: string;
  quoteNumber: string;
  clientEmail: string | null | undefined;
  locale: Locale;
  /** Called after the email has been sent successfully. */
  onSent?: () => void;
}

const translations = {
  en: {
    title: 'Send quote by email',
    description: 'Send this quote as a PDF attachment to your client.',
    emailLabel: 'Client email',
    emailPlaceholder: 'client@example.com',
    subjectLabel: 'Subject',
    messageLabel: 'Message',
    cancel: 'Cancel',
    send: 'Send to client',
    sending: 'Sending...',
    success: 'Quote sent successfully',
    error: 'Failed to send quote',
    emailRequired: 'Client email is required',
    defaultSubject: (quoteNumber: string) => `Your quote ${quoteNumber}`,
    defaultMessage: (quoteNumber: string) =>
      `Hello,\n\nPlease find attached your quote ${quoteNumber}.\n\nFeel free to contact us if you have any questions.\n\nBest regards,`,
  },
  fr: {
    title: 'Envoyer le devis par e-mail',
    description: 'Envoyer ce devis en pièce jointe PDF au client.',
    emailLabel: 'E-mail du client',
    emailPlaceholder: 'client@exemple.com',
    subjectLabel: 'Objet',
    messageLabel: 'Message',
    cancel: 'Annuler',
    send: 'Envoyer au client',
    sending: 'Envoi en cours...',
    success: 'Devis envoyé avec succès',
    error: "Impossible d'envoyer le devis",
    emailRequired: "L'e-mail du client est requis",
    defaultSubject: (quoteNumber: string) => `Votre devis ${quoteNumber}`,
    defaultMessage: (quoteNumber: string) =>
      `Bonjour,\n\nVeuillez trouver ci-joint votre devis ${quoteNumber}.\n\nN'hésitez pas à revenir vers nous pour toute question.\n\nBien cordialement,`,
  },
};

export default function SendQuoteModal({
  open,
  onOpenChange,
  quoteId,
  quoteNumber,
  clientEmail,
  locale,
  onSent,
}: SendQuoteModalProps) {
  const t = translations[locale];

  const [email, setEmail] = useState(clientEmail || '');
  const [subject, setSubject] = useState(t.defaultSubject(quoteNumber));
  const [message, setMessage] = useState(t.defaultMessage(quoteNumber));
  const [sending, setSending] = useState(false);

  // Reset fields when modal opens with new data
  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setEmail(clientEmail || '');
      setSubject(t.defaultSubject(quoteNumber));
      setMessage(t.defaultMessage(quoteNumber));
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
      const response = await fetch(`/api/quotes/${quoteId}/send`, {
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
      onOpenChange(false);
      onSent?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.error);
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SendIcon className="size-4" />
            {t.title}
          </DialogTitle>
          <DialogDescription>{t.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="send-quote-email">{t.emailLabel}</Label>
            <Input
              id="send-quote-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t.emailPlaceholder}
              disabled={sending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="send-quote-subject">{t.subjectLabel}</Label>
            <Input
              id="send-quote-subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={sending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="send-quote-message">{t.messageLabel}</Label>
            <textarea
              id="send-quote-message"
              className="flex min-h-35 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={sending}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            {t.cancel}
          </Button>
          <Button type="button" onClick={handleSend} disabled={sending}>
            {sending ? (
              <>
                <Loader2Icon className="size-4 animate-spin" />
                {t.sending}
              </>
            ) : (
              <>
                <SendIcon className="size-4" />
                {t.send}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
