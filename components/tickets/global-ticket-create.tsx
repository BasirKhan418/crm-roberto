'use client';

import { useState } from 'react';

import { MessageSquarePlusIcon } from 'lucide-react';

import { CreateTicketDialog } from '@/components/tickets/create-ticket-dialog';
import { Button } from '@/components/ui/button';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { useLocale } from '@/components/providers/locale-provider';
import { useAuthMe } from '@/hooks/useAuthMe';
import { hasModuleActionAccess } from '@/lib/route-access';

type GlobalTicketCreateProps = {
  trigger?: 'button' | 'menu-item';
};

export function GlobalTicketCreate({ trigger = 'button' }: GlobalTicketCreateProps) {
  const [open, setOpen] = useState(false);
  const { locale } = useLocale();
  const { user, loading } = useAuthMe();

  if (
    loading ||
    user?.featureFlags?.tickets === false ||
    !hasModuleActionAccess({
      role: user?.role,
      modulePermissions: user?.modulePermissions,
      moduleKey: 'tickets',
      action: 'manage',
    })
  ) {
    return null;
  }

  const label = locale === 'fr' ? 'Nouveau ticket' : 'New ticket';

  return (
    <>
      {trigger === 'menu-item' ? (
        <DropdownMenuItem onSelect={() => setOpen(true)}>
          <MessageSquarePlusIcon className="size-4" />
          {label}
        </DropdownMenuItem>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 rounded-full px-3"
          aria-label={label}
          onClick={() => setOpen(true)}
        >
          <MessageSquarePlusIcon className="size-4" />
          <span className="hidden sm:inline">{label}</span>
        </Button>
      )}

      <CreateTicketDialog open={open} onOpenChange={setOpen} locale={locale} />
    </>
  );
}
