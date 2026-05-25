'use client';

import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type CompanyItem = { _id: string; name: string };

export default function AdminLogsPage() {
  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [companyId, setCompanyId] = useState('all');
  const [period, setPeriod] = useState('all');
  const [eventType, setEventType] = useState('all');
  const [entityType, setEntityType] = useState('all');
  const [search, setSearch] = useState('');
  const [connectionLogs, setConnectionLogs] = useState<Array<Record<string, unknown>>>([]);
  const [auditLogs, setAuditLogs] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadLogs() {
      try {
        const companyParam = companyId !== 'all' ? `companyId=${encodeURIComponent(companyId)}&` : '';
        const searchParam = search.trim() ? `search=${encodeURIComponent(search.trim())}&` : '';
        const periodParam = period !== 'all' ? `period=${encodeURIComponent(period)}&` : '';
        const eventParam = eventType !== 'all' ? `eventType=${encodeURIComponent(eventType)}&` : '';
        const entityParam = entityType !== 'all' ? `entityType=${encodeURIComponent(entityType)}&` : '';

        const [companiesResponse, connectionResponse, auditResponse] = await Promise.all([
          fetch('/api/admin/companies', { cache: 'no-store' }),
          fetch(`/api/admin/connection-logs?${companyParam}${searchParam}${periodParam}${eventParam}`, { cache: 'no-store' }),
          fetch(`/api/admin/audit-logs?${companyParam}${entityParam}`, { cache: 'no-store' }),
        ]);

        if (cancelled) {
          return;
        }

        const companiesPayload = (await companiesResponse.json().catch(() => null)) as { data?: { items?: CompanyItem[] } } | null;
        const connectionPayload = (await connectionResponse.json().catch(() => null)) as { data?: { items?: Array<Record<string, unknown>> } } | null;
        const auditPayload = (await auditResponse.json().catch(() => null)) as { data?: { items?: Array<Record<string, unknown>> } } | null;

        setCompanies(companiesPayload?.data?.items || []);
        setConnectionLogs(connectionPayload?.data?.items || []);
        setAuditLogs(auditPayload?.data?.items || []);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadLogs();

    return () => {
      cancelled = true;
    };
  }, [companyId, entityType, eventType, period, refreshKey, search]);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-5">
        <Select value={companyId} onValueChange={(value) => {
          setLoading(true);
          setCompanyId(value);
        }}>
          <SelectTrigger><SelectValue placeholder="Company" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All companies</SelectItem>
            {companies.map((company) => <SelectItem key={company._id} value={company._id}>{company.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={eventType} onValueChange={(value) => {
          setLoading(true);
          setEventType(value);
        }}>
          <SelectTrigger><SelectValue placeholder="Event type" /></SelectTrigger>
          <SelectContent>
            {['all', 'login_success', 'login_failed', 'logout', 'portal_login_success', 'portal_login_failed', 'force_logout', 'revoke_access'].map((value) => (
              <SelectItem key={value} value={value}>{value}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={entityType} onValueChange={(value) => {
          setLoading(true);
          setEntityType(value);
        }}>
          <SelectTrigger><SelectValue placeholder="Entity" /></SelectTrigger>
          <SelectContent>
            {['all', 'expense', 'invoice', 'supplier', 'user', 'ticket', 'report'].map((value) => (
              <SelectItem key={value} value={value}>{value}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={period} onValueChange={(value) => {
          setLoading(true);
          setPeriod(value);
        }}>
          <SelectTrigger><SelectValue placeholder="Period" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All time</SelectItem>
            <SelectItem value="24h">Last 24 hours</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <Input value={search} onChange={(event) => {
            setLoading(true);
            setSearch(event.target.value);
          }} placeholder="IP or device" />
          <Button variant="outline" onClick={() => {
            setLoading(true);
            setRefreshKey((current) => current + 1);
          }} disabled={loading}>
            <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Connection logs</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {connectionLogs.map((log, index) => (
              <div key={String(log._id || index)} className="rounded-lg border border-border/60 px-3 py-2 text-sm">
                <div className="font-medium text-slate-950">{String(log.eventType || '-')}</div>
                <div className="text-muted-foreground">{String(log.ipAddress || '')} {String(log.deviceLabel || '')}</div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Audit logs</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {auditLogs.map((log, index) => (
              <div key={String(log._id || index)} className="rounded-lg border border-border/60 px-3 py-2 text-sm">
                <div className="font-medium text-slate-950">{String(log.entityType || '-')} / {String(log.action || '-')}</div>
                <div className="text-muted-foreground">{String(log.fieldName || '')}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}