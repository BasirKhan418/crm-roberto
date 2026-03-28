'use client';

import { useCallback, useEffect, useState } from 'react';

export interface ClientOption {
  _id: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  companyName?: string | null;
  vatNumber?: string | null;
}

interface ClientsApiResponse {
  success: boolean;
  message?: string;
  data?: ClientOption[];
}

export function useClients() {
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/clients?page=1&limit=100&sortBy=fullName&sortOrder=asc', {
        cache: 'no-store',
      });

      const payload = (await response.json()) as ClientsApiResponse;
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Failed to load clients');
      }

      setClients(payload.data ?? []);
    } catch (fetchError) {
      setClients([]);
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load clients');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return {
    clients,
    loading,
    error,
    refetch,
  };
}
