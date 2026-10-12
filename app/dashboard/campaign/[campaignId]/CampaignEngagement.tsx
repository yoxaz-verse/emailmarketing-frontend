'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Building2, ChevronDown, ExternalLink, RefreshCw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { clientFetch } from '@/lib/client-fetch';
import { cn } from '@/lib/utils';

type EngagementStatus = 'opened' | 'replied' | 'bounced' | 'all';
type TimelineEvent = {
  id: string;
  type: 'sent' | 'opened' | 'replied' | 'bounced';
  occurred_at: string;
  sender_inbox_email?: string | null;
  source: string;
  detail?: string | null;
};
type Contact = {
  campaign_lead_id: string;
  lead_id: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  timeline: TimelineEvent[];
};
type CompanyRow = {
  company: string;
  contact_count: number;
  opens: number;
  replies: number;
  bounces: number;
  latest_activity_at?: string | null;
  contacts: Contact[];
};
type EngagementResponse = {
  rows: CompanyRow[];
  total: number;
  page: number;
  page_size: number;
  status: EngagementStatus;
};

const filters: Array<{ value: EngagementStatus; label: string }> = [
  { value: 'opened', label: 'Opened' },
  { value: 'replied', label: 'Replied' },
  { value: 'bounced', label: 'Bounced' },
  { value: 'all', label: 'All activity' },
];

const eventStyles: Record<TimelineEvent['type'], string> = {
  sent: 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  opened: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  replied: 'border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300',
  bounced: 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300',
};

function contactName(contact: Contact) {
  return [contact.first_name, contact.last_name].filter(Boolean).join(' ') || 'Unnamed contact';
}

export default function CampaignEngagement({ campaignId, status }: { campaignId: string; status: EngagementStatus }) {
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [data, setData] = useState<EngagementResponse>({ rows: [], total: 0, page: 1, page_size: 25, status });
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => { setPage(1); }, [status, debouncedQuery]);

  const load = useCallback(async (fullLoading = false) => {
    if (fullLoading) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const params = new URLSearchParams({ status, page: String(page), page_size: '25' });
      if (debouncedQuery) params.set('q', debouncedQuery);
      const result = await clientFetch<EngagementResponse>(`/campaigns/${campaignId}/engagement?${params.toString()}`);
      setData(result);
      setExpanded(new Set());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Campaign engagement is unavailable.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [campaignId, debouncedQuery, page, status]);

  useEffect(() => { void load(true); }, [load]);

  const totalPages = Math.max(1, Math.ceil(data.total / data.page_size));
  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);
  const toggle = (company: string) => setExpanded((current) => {
    const next = new Set(current);
    if (next.has(company)) next.delete(company);
    else next.add(company);
    return next;
  });

  return (
    <section className="rounded-xl border border-border bg-card/50 p-5 dark:border-white/[0.14] dark:bg-white/[0.055] dark:shadow-[0_12px_36px_rgb(0,0,0,0.28)]">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div>
          <div className="flex items-center gap-2"><Building2 className="size-5 text-primary" /><h2 className="text-lg font-semibold">Company engagement</h2></div>
          <p className="mt-1 text-sm text-muted-foreground">Review companies and contacts by their recorded campaign activity. Open tracking may be affected by email-client privacy features.</p>
        </div>
        <Button variant="outline" onClick={() => void load(false)} disabled={loading || refreshing}><RefreshCw className={cn(refreshing && 'animate-spin')} />Refresh</Button>
      </div>

      <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <nav className="flex flex-wrap gap-2" aria-label="Engagement filters">
          {filters.map((filter) => <Link key={filter.value} href={`/dashboard/campaign/${campaignId}?tab=engagement&status=${filter.value}`} className={cn('rounded-md border px-3 py-2 text-sm transition-colors', status === filter.value ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background hover:bg-muted')}>{filter.label}</Link>)}
        </nav>
        <div className="relative w-full lg:max-w-sm"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search company or contact" className="pl-9" /></div>
      </div>

      {error ? <div className="mt-5 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-700 dark:text-amber-300">{error}</div> : (
        <div className="mt-5 overflow-x-auto rounded-lg border border-border dark:border-white/[0.12] dark:bg-black/20">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-muted/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground"><tr><th className="p-3">Company</th><th>Contacts</th><th>Opens</th><th>Replies</th><th>Bounces</th><th>Latest activity</th><th className="w-12"><span className="sr-only">Details</span></th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={7} className="p-10 text-center text-muted-foreground">Loading company engagement…</td></tr> : data.rows.length === 0 ? <tr><td colSpan={7} className="p-10 text-center text-muted-foreground">No companies match this activity filter.</td></tr> : data.rows.map((row) => {
                const isExpanded = expanded.has(row.company);
                return <CompanyEngagementRows key={row.company} row={row} expanded={isExpanded} onToggle={() => toggle(row.company)} campaignId={campaignId} />;
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground"><span>{data.total.toLocaleString()} companies · Page {data.page} of {totalPages}</span><div className="flex gap-2"><Button size="sm" variant="outline" disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</Button><Button size="sm" variant="outline" disabled={page >= totalPages || loading} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Next</Button></div></div>
    </section>
  );
}

function CompanyEngagementRows({ row, expanded, onToggle, campaignId }: { row: CompanyRow; expanded: boolean; onToggle: () => void; campaignId: string }) {
  return <>
    <tr className="border-t border-border/70 dark:border-white/10">
      <td className="p-3 font-semibold">{row.company}</td><td>{row.contact_count}</td><td>{row.opens}</td><td>{row.replies}</td><td>{row.bounces}</td><td>{row.latest_activity_at ? new Date(row.latest_activity_at).toLocaleString() : '—'}</td>
      <td><button type="button" onClick={onToggle} aria-expanded={expanded} aria-label={`${expanded ? 'Collapse' : 'Expand'} ${row.company}`} className="rounded-md p-2 hover:bg-muted"><ChevronDown className={cn('size-4 transition-transform', expanded && 'rotate-180')} /></button></td>
    </tr>
    {expanded ? <tr className="border-t border-border/70 bg-muted/15 dark:border-white/10"><td colSpan={7} className="p-4"><div className="space-y-4">{row.contacts.map((contact) => <div key={contact.campaign_lead_id} className="rounded-lg border border-border bg-background/70 p-4 dark:border-white/[0.12] dark:bg-black/20"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="font-medium">{contactName(contact)}</div><div className="text-xs text-muted-foreground">{contact.email || 'Email unavailable'}</div></div>{contact.timeline.some((event) => event.type === 'replied') ? <Link href={`/dashboard/campaign/replies?campaign_id=${campaignId}`} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">View reply details <ExternalLink className="size-3" /></Link> : null}</div><ol className="mt-4 space-y-2 border-l border-border pl-4">{contact.timeline.map((event) => <li key={event.id} className="relative"><span className="absolute -left-[1.29rem] top-2 size-2 rounded-full bg-primary" /><div className="flex flex-wrap items-center gap-2"><span className={cn('rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize', eventStyles[event.type])}>{event.type}</span><time className="text-xs text-muted-foreground">{new Date(event.occurred_at).toLocaleString()}</time>{event.sender_inbox_email ? <span className="text-xs text-muted-foreground">via {event.sender_inbox_email}</span> : null}{event.source === 'click_proxy' ? <span className="text-[11px] text-muted-foreground">link interaction evidence</span> : null}</div>{event.detail ? <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{event.detail}</p> : null}</li>)}</ol></div>)}</div></td></tr> : null}
  </>;
}
