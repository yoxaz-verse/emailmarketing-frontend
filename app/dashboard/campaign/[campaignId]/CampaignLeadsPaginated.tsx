'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { clientFetch } from '@/lib/client-fetch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { attachFolderLeadsAction, attachLeadsAction, detachLeadsAction } from './actions';
import { toast } from 'react-hot-toast';

type Lead = {
  id: string;
  email?: string | null;
  first_name?: string | null;
  company?: string | null;
  email_eligibility?: string | null;
  is_suppressed?: boolean | null;
};

type PageResponse = {
  rows: Lead[];
  total: number;
  page: number;
  page_size: number;
};

export default function CampaignLeadsPaginated({
  campaignId,
  campaignStatus,
  folders,
}: {
  campaignId: string;
  campaignStatus?: string | null;
  folders: Array<{ id: string; name: string }>;
}) {
  const [scope, setScope] = useState<'attached' | 'available'>('attached');
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [folderId, setFolderId] = useState('');
  const [data, setData] = useState<PageResponse>({ rows: [], total: 0, page: 1, page_size: 50 });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const locked = String(campaignStatus ?? '').toLowerCase() === 'running';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ scope, page: String(page), page_size: '50' });
      if (query.trim()) params.set('q', query.trim());
      if (folderId) params.set('folder_id', folderId);
      const result = await clientFetch<PageResponse>(`/campaigns/${campaignId}/leads/page?${params.toString()}`);
      setData(result);
      setSelected(new Set());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load campaign leads');
    } finally {
      setLoading(false);
    }
  }, [campaignId, folderId, page, query, scope]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), query ? 300 : 0);
    return () => window.clearTimeout(timer);
  }, [load, query]);

  const totalPages = Math.max(1, Math.ceil(data.total / data.page_size));
  const allSelected = data.rows.length > 0 && data.rows.every((lead) => selected.has(lead.id));
  const selectedIds = useMemo(() => Array.from(selected), [selected]);

  async function mutate() {
    if (locked || selectedIds.length === 0 || mutating) return;
    setMutating(true);
    try {
      const result = scope === 'attached'
        ? await detachLeadsAction(campaignId, selectedIds)
        : await attachLeadsAction(campaignId, selectedIds);
      if (!result.success) throw new Error(result.error);
      toast.success(scope === 'attached' ? 'Selected leads removed.' : 'Selected leads attached.');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Lead update failed');
    } finally {
      setMutating(false);
    }
  }

  async function attachFolder() {
    if (!folderId || locked || mutating) return;
    setMutating(true);
    try {
      const result = await attachFolderLeadsAction(campaignId, [folderId]);
      if (!result.success) throw new Error(result.error);
      toast.success(`Attached ${result.inserted} lead(s) from folder.`);
      setScope('attached');
      setPage(1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Folder attach failed');
    } finally {
      setMutating(false);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card/50 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-base font-semibold">Campaign Leads</h2>
          <p className="text-xs text-muted-foreground">Server-paginated; only the visible 50 rows are transferred.</p>
        </div>
        <div className="flex gap-2">
          {(['attached', 'available'] as const).map((value) => (
            <Button key={value} size="sm" variant={scope === value ? 'default' : 'outline'} onClick={() => { setScope(value); setPage(1); }}>
              {value === 'attached' ? 'Attached' : 'Available'}
            </Button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-[1fr_240px_auto]">
        <Input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search email, name, or company" />
        <select className="h-9 rounded-md border border-border bg-background px-3 text-sm" value={folderId} onChange={(event) => { setFolderId(event.target.value); setPage(1); }}>
          <option value="">All folders</option>
          {folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
        </select>
        {scope === 'available' && folderId ? <Button variant="outline" onClick={() => void attachFolder()} disabled={locked || mutating}>Attach folder</Button> : <span />}
      </div>

      {locked ? <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-xs text-amber-700 dark:text-amber-300">Pause the campaign before changing leads.</div> : null}

      <div className="mt-4 overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[680px] text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr><th className="p-3"><input type="checkbox" checked={allSelected} onChange={(event) => setSelected(event.target.checked ? new Set(data.rows.map((lead) => lead.id)) : new Set())} /></th><th>Email</th><th>Name</th><th>Company</th><th>Eligibility</th></tr>
          </thead>
          <tbody>
            {loading ? <tr><td className="p-6 text-center text-muted-foreground" colSpan={5}>Loading leads…</td></tr> : data.rows.length === 0 ? <tr><td className="p-6 text-center text-muted-foreground" colSpan={5}>No leads found.</td></tr> : data.rows.map((lead) => (
              <tr key={lead.id} className="border-t border-border">
                <td className="p-3"><input type="checkbox" checked={selected.has(lead.id)} onChange={(event) => setSelected((current) => { const next = new Set(current); if (event.target.checked) next.add(lead.id); else next.delete(lead.id); return next; })} /></td>
                <td className="py-3 pr-3">{lead.email || '—'}</td><td className="py-3 pr-3">{lead.first_name || '—'}</td><td className="py-3 pr-3">{lead.company || '—'}</td><td className="py-3 pr-3 capitalize">{lead.is_suppressed ? 'suppressed' : lead.email_eligibility || 'pending'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>{data.total.toLocaleString()} total · Page {data.page} of {totalPages}</span>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1 || loading}>Previous</Button>
          <Button size="sm" variant="outline" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={page >= totalPages || loading}>Next</Button>
          <Button size="sm" onClick={() => void mutate()} disabled={locked || mutating || selected.size === 0}>{scope === 'attached' ? 'Remove selected' : 'Attach selected'}</Button>
        </div>
      </div>
    </section>
  );
}
