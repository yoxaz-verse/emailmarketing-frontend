'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Paperclip, UserPlus } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { clientFetch } from '@/lib/client-fetch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { attachFolderLeadsAction, attachLeadsAction, detachLeadsAction } from './actions';

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

type LeadScope = 'attached' | 'available';

function LeadPanel({
  campaignId,
  scope,
  locked,
  folders,
  revision,
  onChanged,
}: {
  campaignId: string;
  scope: LeadScope;
  locked: boolean;
  folders: Array<{ id: string; name: string }>;
  revision: number;
  onChanged: () => void;
}) {
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [folderId, setFolderId] = useState('');
  const [data, setData] = useState<PageResponse>({ rows: [], total: 0, page: 1, page_size: 50 });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ scope, page: String(page), page_size: '50' });
      if (query.trim()) params.set('q', query.trim());
      if (scope === 'available' && folderId) params.set('folder_id', folderId);
      const result = await clientFetch<PageResponse>(`/campaigns/${campaignId}/leads/page?${params.toString()}`);
      setData(result);
      setSelected(new Set());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Failed to load ${scope} leads`);
    } finally {
      setLoading(false);
    }
  }, [campaignId, folderId, page, query, scope]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), query ? 300 : 0);
    return () => window.clearTimeout(timer);
  }, [load, query, revision]);

  const totalPages = Math.max(1, Math.ceil(data.total / data.page_size));
  const allSelected = data.rows.length > 0 && data.rows.every((lead) => selected.has(lead.id));
  const selectedIds = useMemo(() => Array.from(selected), [selected]);

  async function mutateSelection() {
    if (locked || mutating || selectedIds.length === 0) return;
    try {
      setMutating(true);
      const result = scope === 'attached'
        ? await detachLeadsAction(campaignId, selectedIds)
        : await attachLeadsAction(campaignId, selectedIds);
      if (!result.success) throw new Error(result.error);
      toast.success(scope === 'attached' ? 'Selected leads removed.' : 'Selected leads attached.');
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Lead update failed');
    } finally {
      setMutating(false);
    }
  }

  async function attachFolder() {
    if (!folderId || locked || mutating) return;
    try {
      setMutating(true);
      const result = await attachFolderLeadsAction(campaignId, [folderId]);
      if (!result.success) throw new Error(result.error);
      toast.success(`Attached ${result.inserted} lead(s) from folder.`);
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Folder attachment failed');
    } finally {
      setMutating(false);
    }
  }

  const isAttached = scope === 'attached';
  return (
    <section className="min-w-0 rounded-xl border border-border bg-card/50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            {isAttached ? <Paperclip className="size-4 text-primary" /> : <UserPlus className="size-4 text-primary" />}
            <h2 className="font-semibold">{isAttached ? 'Attached leads' : 'Available leads'}</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{data.total.toLocaleString()} total · independently paginated</p>
        </div>
        <span className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs">{selected.size} selected</span>
      </div>

      <div className="mt-4 space-y-2">
        <Input
          value={query}
          onChange={(event) => { setQuery(event.target.value); setPage(1); }}
          placeholder={`Search ${scope} leads`}
        />
        {!isAttached ? (
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <select
              className="h-9 min-w-0 rounded-md border border-border bg-background px-3 text-sm"
              value={folderId}
              onChange={(event) => { setFolderId(event.target.value); setPage(1); }}
            >
              <option value="">All folders</option>
              {folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
            </select>
            <Button variant="outline" onClick={() => void attachFolder()} disabled={!folderId || locked || mutating}>Attach folder</Button>
          </div>
        ) : null}
      </div>

      {locked ? <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-xs text-amber-700 dark:text-amber-300">Pause the campaign before changing leads.</div> : null}

      <div className="mt-4 overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-muted/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="w-10 p-3"><input aria-label={`Select all ${scope} leads`} type="checkbox" checked={allSelected} onChange={(event) => setSelected(event.target.checked ? new Set(data.rows.map((lead) => lead.id)) : new Set())} /></th>
              <th className="pr-3">Lead</th>
              <th className="pr-3">Company</th>
              <th className="pr-3">Eligibility</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="p-8 text-center text-muted-foreground" colSpan={4}>Loading leads…</td></tr>
            ) : data.rows.length === 0 ? (
              <tr><td className="p-8 text-center text-muted-foreground" colSpan={4}>No {scope} leads found.</td></tr>
            ) : data.rows.map((lead) => (
              <tr key={lead.id} className="border-t border-border/70">
                <td className="p-3"><input aria-label={`Select ${lead.email || 'lead'}`} type="checkbox" checked={selected.has(lead.id)} onChange={(event) => setSelected((current) => { const next = new Set(current); if (event.target.checked) next.add(lead.id); else next.delete(lead.id); return next; })} /></td>
                <td className="py-3 pr-3"><div className="max-w-56 truncate font-medium" title={lead.email || ''}>{lead.email || '—'}</div><div className="text-xs text-muted-foreground">{lead.first_name || 'Unnamed'}</div></td>
                <td className="max-w-40 truncate py-3 pr-3" title={lead.company || ''}>{lead.company || '—'}</td>
                <td className="py-3 pr-3 capitalize">{lead.is_suppressed ? 'suppressed' : lead.email_eligibility || 'pending'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>Page {data.page} of {totalPages}</span>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1 || loading}>Previous</Button>
          <Button size="sm" variant="outline" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={page >= totalPages || loading}>Next</Button>
          <Button size="sm" onClick={() => void mutateSelection()} disabled={locked || mutating || selected.size === 0}>
            {mutating ? 'Updating…' : isAttached ? 'Remove selected' : 'Attach selected'}
          </Button>
        </div>
      </div>
    </section>
  );
}

export default function CampaignLeadsPaginated({
  campaignId,
  campaignStatus,
  folders,
}: {
  campaignId: string;
  campaignStatus?: string | null;
  folders: Array<{ id: string; name: string }>;
}) {
  const [revision, setRevision] = useState(0);
  const locked = String(campaignStatus ?? '').toLowerCase() === 'running';
  const refreshBoth = () => setRevision((value) => value + 1);

  return (
    <div className="grid items-start gap-6 xl:grid-cols-2">
      <LeadPanel campaignId={campaignId} scope="attached" locked={locked} folders={folders} revision={revision} onChanged={refreshBoth} />
      <LeadPanel campaignId={campaignId} scope="available" locked={locked} folders={folders} revision={revision} onChanged={refreshBoth} />
    </div>
  );
}
