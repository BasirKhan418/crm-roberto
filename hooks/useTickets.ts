'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  TICKET_ALLOWED_MIME_TYPES,
  type TicketLinkedType,
  type TicketStatus,
  type TicketType,
} from '@/lib/tickets/constants';
import {
  getExpenseFileExtension,
  isExpenseMimeTypeAllowed,
} from '@/lib/expenses/upload';

export type TicketUser = {
  _id: string;
  name?: string;
  email?: string;
  role?: string;
  invitationStatus?: string;
  account_status?: string;
};

export type TicketAttachment = {
  _id?: string;
  originalName: string;
  displayName: string;
  mimeType: string;
  extension: string;
  sizeBytes: number;
  storageKey: string;
  url: string;
  checksum?: string | null;
};

export type TicketMessage = {
  _id: string;
  body?: string;
  createdAt?: string;
  author?: TicketUser | null;
  authorId?: TicketUser | string;
  attachments?: TicketAttachment[];
};

export type TicketListItem = {
  _id: string;
  title: string;
  type: TicketType;
  status: TicketStatus;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: TicketUser | string;
  assignedTo?: TicketUser[];
  linkedType?: TicketLinkedType | null;
  linkedId?: string | null;
  messageCount?: number;
  lastMessageAt?: string;
  unreadCount?: number;
  isUnreadForMe?: boolean;
};

export type TicketThread = TicketListItem & {
  unreadBy?: TicketUser[];
  messages: TicketMessage[];
  attachments?: TicketAttachment[];
  auditLogs?: Array<Record<string, unknown>>;
};

export type TicketFilters = {
  status?: TicketStatus;
  type?: TicketType;
  linkedType?: TicketLinkedType;
  linkedId?: string;
  assignedToMe?: boolean;
  createdByMe?: boolean;
  unreadOnly?: boolean;
  search?: string;
  sortBy?: 'updatedAt' | 'createdAt' | 'title' | 'status' | 'type';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
};

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

type TicketLookupsResponse = {
  success: boolean;
  message?: string;
  users?: TicketUser[];
};

type TicketMutationResponse = {
  success: boolean;
  message?: string;
  ticket?: TicketListItem | TicketThread;
  data?: {
    message?: TicketMessage;
    status?: TicketStatus;
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

export function useTickets(filters?: TicketFilters, enabled = true) {
  const [tickets, setTickets] = useState<TicketListItem[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    params.set('page', String(filters?.page || 1));
    params.set('limit', String(filters?.limit || 20));

    if (filters?.status) params.set('status', filters.status);
    if (filters?.type) params.set('type', filters.type);
    if (filters?.linkedType) params.set('linkedType', filters.linkedType);
    if (filters?.linkedId) params.set('linkedId', filters.linkedId);
    if (filters?.assignedToMe) params.set('assignedToMe', 'true');
    if (filters?.createdByMe) params.set('createdByMe', 'true');
    if (filters?.unreadOnly) params.set('unreadOnly', 'true');
    if (filters?.search) params.set('search', filters.search);
    if (filters?.sortBy) params.set('sortBy', filters.sortBy);
    if (filters?.sortOrder) params.set('sortOrder', filters.sortOrder);

    return params.toString();
  }, [filters]);

  const refetch = useCallback(async () => {
    if (!enabled) {
      setTickets([]);
      setPagination({ page: 1, limit: 20, total: 0, totalPages: 0 });
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/tickets?${query}`, { cache: 'no-store' });
      const payload = (await response.json().catch(() => null)) as TicketListResponse | null;

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || 'Failed to load tickets');
      }

      setTickets(payload.items || []);
      setPagination(payload.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 });
    } catch (fetchError) {
      setTickets([]);
      setPagination({ page: 1, limit: 20, total: 0, totalPages: 0 });
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load tickets');
    } finally {
      setLoading(false);
    }
  }, [enabled, query]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return {
    tickets,
    pagination,
    loading,
    error,
    refetch,
  };
}

export function useTicketThread(ticketId?: string) {
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
      const response = await fetch(`/api/tickets/${ticketId}`, { cache: 'no-store' });
      const payload = (await response.json().catch(() => null)) as TicketThreadResponse | null;

      if (!response.ok || !payload?.success || !payload.ticket) {
        throw new Error(payload?.message || 'Failed to load ticket thread');
      }

      setTicket(payload.ticket);
    } catch (fetchError) {
      setTicket(null);
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load ticket thread');
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return {
    ticket,
    loading,
    error,
    refetch,
  };
}

export function useTicketRecipients(search?: string, limit = 30) {
  const [users, setUsers] = useState<TicketUser[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    if (search?.trim()) {
      params.set('search', search.trim());
    }
    return params.toString();
  }, [limit, search]);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/tickets/lookups?${query}`, { cache: 'no-store' });
      const payload = (await response.json().catch(() => null)) as TicketLookupsResponse | null;

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || 'Failed to load ticket recipients');
      }

      setUsers(payload.users || []);
    } catch (fetchError) {
      setUsers([]);
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load ticket recipients');
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return {
    users,
    loading,
    error,
    refetch,
  };
}

export async function uploadTicketFiles(files: File[]) {
  const attachments: TicketAttachment[] = [];

  for (const file of files) {
    const mimeType = inferTicketMimeType(file);
    if (!mimeType) {
      throw new Error(`Unsupported file type for ${file.name}`);
    }

    const presignResponse = await fetch('/api/tickets/upload-presign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: file.name,
        fileType: mimeType,
        fileSize: file.size,
      }),
    });

    const presignPayload = (await presignResponse.json().catch(() => null)) as
      | {
          success: boolean;
          message?: string;
          uploadUrl?: string;
          fileUrl?: string;
          key?: string;
        }
      | null;

    if (
      !presignResponse.ok ||
      !presignPayload?.success ||
      !presignPayload.uploadUrl ||
      !presignPayload.fileUrl ||
      !presignPayload.key
    ) {
      throw new Error(presignPayload?.message || `Unable to prepare upload for ${file.name}`);
    }

    const uploadResponse = await fetch(presignPayload.uploadUrl, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': mimeType,
      },
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

export async function createTicket(input: {
  title: string;
  type: TicketType;
  assignedTo?: string[];
  linkedType?: TicketLinkedType | null;
  linkedId?: string | null;
  body?: string | null;
  attachments?: TicketAttachment[];
}) {
  const response = await fetch('/api/tickets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  const payload = (await response.json().catch(() => null)) as TicketMutationResponse | null;

  if (!response.ok || !payload?.success) {
    throw new Error(payload?.message || 'Failed to create ticket');
  }

  return payload;
}

export async function replyTicket(input: {
  ticketId: string;
  body?: string | null;
  attachments?: TicketAttachment[];
}) {
  const response = await fetch(`/api/tickets/${input.ticketId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      body: input.body,
      attachments: input.attachments || [],
    }),
  });

  const payload = (await response.json().catch(() => null)) as TicketMutationResponse | null;

  if (!response.ok || !payload?.success) {
    throw new Error(payload?.message || 'Failed to send reply');
  }

  return payload;
}

export async function changeTicketStatus(input: { ticketId: string; status: TicketStatus }) {
  const response = await fetch(`/api/tickets/${input.ticketId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: input.status }),
  });

  const payload = (await response.json().catch(() => null)) as TicketMutationResponse | null;

  if (!response.ok || !payload?.success) {
    throw new Error(payload?.message || 'Failed to update ticket status');
  }

  return payload;
}

export async function markTicketRead(ticketId: string) {
  const response = await fetch(`/api/tickets/${ticketId}/read`, {
    method: 'POST',
  });

  const payload = (await response.json().catch(() => null)) as TicketMutationResponse | null;

  if (!response.ok || !payload?.success) {
    throw new Error(payload?.message || 'Failed to mark ticket as read');
  }

  return payload;
}
