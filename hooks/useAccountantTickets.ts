'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import type { TicketAttachment, TicketFilters, TicketListItem, TicketThread } from '@/hooks/useTickets';
import { TICKET_ALLOWED_MIME_TYPES } from '@/lib/tickets/constants';
import type { AccountantPurchaseTicketReason } from '@/lib/tickets/accountant-purchase-ticket';
import type { AccountantSalesTicketReason } from '@/lib/tickets/accountant-sales-ticket';
import { getExpenseFileExtension, isExpenseMimeTypeAllowed } from '@/lib/expenses/upload';

type TicketListResponse = {
  success: boolean;
  message?: string;
  items?: TicketListItem[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

type TicketThreadResponse = {
  success: boolean;
  message?: string;
  ticket?: TicketThread;
};

type TicketMutationResponse = {
  success: boolean;
  message?: string;
  ticket?: TicketListItem | TicketThread;
  data?: {
    message?: TicketThread['messages'][number];
    ticketId?: string;
  };
};

const extensionToMime: Record<string, (typeof TICKET_ALLOWED_MIME_TYPES)[number]> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic',
};

function inferTicketMimeType(file: File): (typeof TICKET_ALLOWED_MIME_TYPES)[number] | null {
  if (isExpenseMimeTypeAllowed(file.type)) {
    return file.type as (typeof TICKET_ALLOWED_MIME_TYPES)[number];
  }

  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  return extensionToMime[extension] || null;
}

export function useAccountantTickets(filters?: TicketFilters) {
  const [tickets, setTickets] = useState<TicketListItem[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    params.set('page', String(filters?.page || 1));
    params.set('limit', String(filters?.limit || 20));
    if (filters?.status) params.set('status', filters.status);
    if (filters?.unreadOnly) params.set('unreadOnly', 'true');
    if (filters?.search) params.set('search', filters.search);
    if (filters?.sortBy) params.set('sortBy', filters.sortBy);
    if (filters?.sortOrder) params.set('sortOrder', filters.sortOrder);
    return params.toString();
  }, [filters]);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/accountant/tickets?${query}`, { cache: 'no-store' });
      const payload = (await response.json().catch(() => null)) as TicketListResponse | null;

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || 'Failed to load accountant tickets');
      }

      setTickets(payload.items || []);
      setPagination(payload.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 });
    } catch (fetchError) {
      setTickets([]);
      setPagination({ page: 1, limit: 20, total: 0, totalPages: 0 });
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load accountant tickets');
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { tickets, pagination, loading, error, refetch };
}

export function useAccountantTicketThread(ticketId?: string) {
  const [ticket, setTicket] = useState<TicketThread | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(ticketId));
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!ticketId) {
      setTicket(null);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/accountant/tickets/${ticketId}`, { cache: 'no-store' });
      const payload = (await response.json().catch(() => null)) as TicketThreadResponse | null;

      if (!response.ok || !payload?.success || !payload.ticket) {
        throw new Error(payload?.message || 'Failed to load accountant ticket');
      }

      setTicket(payload.ticket);
    } catch (fetchError) {
      setTicket(null);
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load accountant ticket');
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { ticket, loading, error, refetch };
}

export async function uploadAccountantTicketFiles(files: File[]) {
  const attachments: TicketAttachment[] = [];

  for (const file of files) {
    const mimeType = inferTicketMimeType(file);
    if (!mimeType) {
      throw new Error(`Unsupported file type for ${file.name}`);
    }

    const presignResponse = await fetch('/api/accountant/tickets/upload-presign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName: file.name, fileType: mimeType, fileSize: file.size }),
    });

    const presignPayload = (await presignResponse.json().catch(() => null)) as
      | { success: boolean; message?: string; uploadUrl?: string; fileUrl?: string; key?: string }
      | null;

    if (!presignResponse.ok || !presignPayload?.success || !presignPayload.uploadUrl || !presignPayload.fileUrl || !presignPayload.key) {
      throw new Error(presignPayload?.message || `Unable to prepare upload for ${file.name}`);
    }

    const uploadResponse = await fetch(presignPayload.uploadUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': mimeType },
    });

    if (!uploadResponse.ok) {
      throw new Error(`Upload failed for ${file.name}`);
    }

    attachments.push({
      originalName: file.name,
      displayName: file.name,
      mimeType,
      extension: getExpenseFileExtension(file.name, mimeType),
      sizeBytes: file.size,
      storageKey: presignPayload.key,
      url: presignPayload.fileUrl,
      checksum: null,
    });
  }

  return attachments;
}

export async function replyAccountantTicket(input: { ticketId: string; body?: string | null; attachments?: TicketAttachment[] }) {
  const response = await fetch(`/api/accountant/tickets/${input.ticketId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body: input.body, attachments: input.attachments || [] }),
  });

  const payload = (await response.json().catch(() => null)) as TicketMutationResponse | null;
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.message || 'Failed to send accountant ticket reply');
  }

  return payload;
}

export async function changeAccountantTicketStatus(input: { ticketId: string; status: TicketFilters['status'] }) {
  const response = await fetch(`/api/accountant/tickets/${input.ticketId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: input.status }),
  });

  const payload = (await response.json().catch(() => null)) as TicketMutationResponse | null;
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.message || 'Failed to update accountant ticket status');
  }

  return payload;
}

export async function createAccountantExpenseTicket(input: {
  expenseId: string;
  reason: AccountantPurchaseTicketReason;
  note?: string | null;
  locale: 'en' | 'fr';
}) {
  const response = await fetch('/api/accountant/tickets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  const payload = (await response.json().catch(() => null)) as TicketMutationResponse | null;
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.message || 'Failed to create accountant ticket');
  }

  return payload;
}

export async function createAccountantInvoiceTicket(input: {
  invoiceId: string;
  reason: AccountantSalesTicketReason;
  note?: string | null;
  locale: 'en' | 'fr';
}) {
  const response = await fetch('/api/accountant/tickets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  const payload = (await response.json().catch(() => null)) as TicketMutationResponse | null;
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.message || 'Failed to create accountant invoice ticket');
  }

  return payload;
}