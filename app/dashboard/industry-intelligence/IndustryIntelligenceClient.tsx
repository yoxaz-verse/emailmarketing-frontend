'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { clientFetch } from '@/lib/client-fetch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

type SourceMode = 'manual' | 'rss' | 'api' | 'webhook';
type OpportunityStatus = 'new' | 'reviewed' | 'shortlisted' | 'applied' | 'not_relevant' | 'closed';
type OpportunityCategory = 'seed_funding' | 'grant' | 'accelerator' | 'pitch_event' | 'demo_day' | 'investor_call' | 'ecosystem_program';

type IndustrySource = {
  id: string;
  code: string;
  name: string;
  mode: SourceMode;
  status: string;
  region: string | null;
  sector_focus: string[] | null;
  source_url?: string | null;
  supports_fetch: boolean;
  supports_manual: boolean;
  auth_ready: boolean;
  health_status: string;
  last_checked_at?: string | null;
  last_success_at?: string | null;
  last_error?: string | null;
  source_origin?: 'db' | 'fallback';
};

type SourceResult = {
  source_code: string;
  mode: SourceMode;
  status: string;
  fetched_count: number;
  inserted_count: number;
  deduped_count: number;
  failed_count: number;
  latency_ms: number;
  error_message: string | null;
};

type FetchRun = {
  id: string;
  source_code: string | null;
  trigger_mode: string;
  status: string;
  total_received: number;
  inserted_count: number;
  deduped_count: number;
  failed_count: number;
  error_summary: string | null;
  created_at: string;
  metadata: {
    source_results?: SourceResult[];
  };
};

type Opportunity = {
  id: string;
  source_code: string | null;
  source_name: string | null;
  source_url: string | null;
  title: string;
  summary: string | null;
  category: OpportunityCategory;
  sector: string | null;
  geography: string | null;
  funding_stage: string | null;
  amount_text: string | null;
  deadline_date: string | null;
  opportunity_date: string | null;
  organizer_or_investor: string | null;
  relevance_score: number | null;
  status: OpportunityStatus;
  owner: string | null;
  notes: string | null;
  tags: string[];
  useful_for_funding: boolean;
  useful_for_clients: boolean;
  useful_for_partnerships: boolean;
  useful_for_content: boolean;
  created_at: string;
};

type OpportunityDraft = Partial<Opportunity> & {
  tagsText?: string;
};

type Summary = {
  total: number;
  new_count: number;
  shortlisted_count: number;
  applied_count: number;
  healthy_sources?: number;
  total_sources?: number;
  last_run: FetchRun | null;
  source_health: Array<{
    id: string;
    code: string;
    name: string;
    health_status: string;
    last_checked_at: string | null;
    last_success_at: string | null;
    last_error: string | null;
  }>;
};

const UI_FALLBACK_SOURCES: IndustrySource[] = [
  { id: 'ui-fallback-startupindia', code: 'startupindia', name: 'Startup India', mode: 'api', status: 'active', region: 'India', sector_focus: ['startup', 'agri-tech', 'technology'], supports_fetch: true, supports_manual: true, auth_ready: false, health_status: 'fallback', source_origin: 'fallback' },
  { id: 'ui-fallback-agri_uddaan', code: 'agri_uddaan', name: 'Agri Udaan / Agritech Programs', mode: 'manual', status: 'active', region: 'India', sector_focus: ['agri-tech', 'food-tech'], supports_fetch: false, supports_manual: true, auth_ready: false, health_status: 'fallback', source_origin: 'fallback' },
  { id: 'ui-fallback-nasscom', code: 'nasscom', name: 'NASSCOM / DeepTech Programs', mode: 'rss', status: 'active', region: 'India', sector_focus: ['technology', 'deeptech'], supports_fetch: true, supports_manual: true, auth_ready: false, health_status: 'fallback', source_origin: 'fallback' },
  { id: 'ui-fallback-yourstory', code: 'yourstory', name: 'YourStory Funding News', mode: 'rss', status: 'active', region: 'India', sector_focus: ['startup', 'funding'], supports_fetch: true, supports_manual: true, auth_ready: false, health_status: 'fallback', source_origin: 'fallback' },
  { id: 'ui-fallback-inc42', code: 'inc42', name: 'Inc42 Funding & Accelerators', mode: 'rss', status: 'active', region: 'India', sector_focus: ['startup', 'funding'], supports_fetch: true, supports_manual: true, auth_ready: false, health_status: 'fallback', source_origin: 'fallback' },
  { id: 'ui-fallback-investindia', code: 'investindia', name: 'Invest India Programs', mode: 'api', status: 'active', region: 'India', sector_focus: ['startup', 'agri-tech', 'export'], supports_fetch: true, supports_manual: true, auth_ready: false, health_status: 'fallback', source_origin: 'fallback' },
];

const CATEGORIES: OpportunityCategory[] = ['seed_funding', 'grant', 'accelerator', 'pitch_event', 'demo_day', 'investor_call', 'ecosystem_program'];
const STATUSES: OpportunityStatus[] = ['new', 'reviewed', 'shortlisted', 'applied', 'not_relevant', 'closed'];

const EXAMPLE_JSON = JSON.stringify(
  [
    {
      title: 'India agri-tech pitch program for seed-stage startups',
      summary: 'Pitch opportunity for Indian agri-tech and food-tech startups building supply chain or farm productivity platforms.',
      source_name: 'Manual Research',
      source_url: 'https://example.com/agritech-pitch-program',
      category: 'pitch_event',
      sector: 'agri-tech',
      geography: 'India',
      funding_stage: 'seed',
      amount_text: 'Program dependent',
      organizer_or_investor: 'Example Accelerator',
      tags: ['india', 'agri-tech', 'pitch'],
      useful_for_funding: true,
      useful_for_partnerships: true,
      useful_for_content: true
    }
  ],
  null,
  2
);

function parseTags(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value;
  return String(value ?? '').split(',').map((x) => x.trim()).filter(Boolean);
}

export default function IndustryIntelligenceClient() {
  const [activeTab, setActiveTab] = useState<'fetch' | 'review'>('fetch');
  const [hasAutoSelectedTab, setHasAutoSelectedTab] = useState(false);
  const [sources, setSources] = useState<IndustrySource[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [selectedSources, setSelectedSources] = useState<Record<string, boolean>>({});
  const [runs, setRuns] = useState<FetchRun[]>([]);
  const [rows, setRows] = useState<Opportunity[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [manualJson, setManualJson] = useState(EXAMPLE_JSON);
  const [showManualPayload, setShowManualPayload] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, OpportunityDraft>>({});

  const [query, setQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sectorFilter, setSectorFilter] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);

  const chosenSourceCodes = useMemo(
    () => Object.entries(selectedSources).filter(([, value]) => value).map(([code]) => code),
    [selectedSources]
  );
  const totalPages = useMemo(() => Math.max(1, Math.ceil(totalRows / pageSize)), [totalRows, pageSize]);
  const fallbackCatalogActive = sources.some((source) => source.source_origin === 'fallback');
  const latestSourceResults = runs.flatMap((run) => run.metadata?.source_results ?? []).slice(0, 12);

  const loadMeta = useCallback(async () => {
    const [sourceData, runData, summaryData] = await Promise.all([
      clientFetch<IndustrySource[]>('/industry-intelligence/sources'),
      clientFetch<FetchRun[]>('/industry-intelligence/fetch-runs?limit=20'),
      clientFetch<Summary>('/industry-intelligence/summary'),
    ]);
    const sourceRows = (sourceData ?? []).length > 0 ? sourceData : UI_FALLBACK_SOURCES;
    const sortedSources = sourceRows.sort((a, b) => a.name.localeCompare(b.name));
    setSources(sortedSources);
    setSelectedSources((prev) => {
      const next: Record<string, boolean> = {};
      for (const source of sortedSources) {
        next[source.code] = prev[source.code] ?? ['startupindia', 'agri_uddaan', 'inc42'].includes(source.code);
      }
      return next;
    });
    setRuns(runData ?? []);
    setSummary(summaryData ?? null);
  }, []);

  const loadOpportunities = useCallback(async () => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('page_size', String(pageSize));
    if (query.trim()) params.set('q', query.trim());
    if (sourceFilter) params.set('source_code', sourceFilter);
    if (categoryFilter) params.set('category', categoryFilter);
    if (sectorFilter.trim()) params.set('sector', sectorFilter.trim());
    if (stageFilter.trim()) params.set('funding_stage', stageFilter.trim());
    if (statusFilter) params.set('status', statusFilter);

    const response = await clientFetch<{ rows: Opportunity[]; total: number }>(`/industry-intelligence/opportunities?${params.toString()}`);
    setRows(response.rows ?? []);
    setTotalRows(Number(response.total ?? 0));
    if (!hasAutoSelectedTab && Number(response.total ?? 0) > 0) {
      setActiveTab('review');
      setHasAutoSelectedTab(true);
    }
  }, [page, pageSize, query, sourceFilter, categoryFilter, sectorFilter, stageFilter, statusFilter]);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([loadMeta(), loadOpportunities()]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load industry intelligence data');
    } finally {
      setLoading(false);
    }
  }, [loadMeta, loadOpportunities]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    void loadOpportunities();
  }, [loadOpportunities]);

  async function runFetchForSources(sourceCodes: string[]) {
    setError(null);
    setSuccess(null);
    try {
      if (sourceCodes.length === 0) throw new Error('Select at least one source to run fetch');

      const manualOnly = sourceCodes.length === 1 && sources.find((source) => source.code === sourceCodes[0])?.mode === 'manual';
      let body: Record<string, unknown> = { source_codes: sourceCodes };

      if (manualOnly) {
        const parsed = JSON.parse(manualJson);
        if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('Manual JSON must be a non-empty array');
        body = { source_code: sourceCodes[0], items: parsed };
      }

      const result = await clientFetch<{ summary: { source_count?: number; total_received: number; inserted_count: number; deduped_count: number; failed_count: number } }>(
        '/industry-intelligence/fetch-runs',
        { method: 'POST', body: JSON.stringify(body), timeoutMs: 30_000 }
      );

      const summary = result.summary;
      setSuccess(`Fetch completed. Sources: ${summary.source_count ?? sourceCodes.length}, Total: ${summary.total_received}, Inserted: ${summary.inserted_count}, Deduped: ${summary.deduped_count}, Failed: ${summary.failed_count}`);
      await refreshAll();
      setActiveTab('review');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to run industry intelligence fetch');
    }
  }

  async function runFetch() {
    await runFetchForSources(chosenSourceCodes);
  }

  async function runSourceFetch(sourceCode: string) {
    setError(null);
    setSuccess(null);
    try {
      const result = await clientFetch<{ summary: { total_received: number; inserted_count: number; deduped_count: number; failed_count: number } }>(
        '/industry-intelligence/fetch-runs',
        { method: 'POST', body: JSON.stringify({ source_code: sourceCode }), timeoutMs: 30_000 }
      );
      const fetchSummary = result.summary;
      setSuccess(`${sourceCode} fetch completed. Total: ${fetchSummary.total_received}, Inserted: ${fetchSummary.inserted_count}, Deduped: ${fetchSummary.deduped_count}, Failed: ${fetchSummary.failed_count}`);
      await refreshAll();
      setActiveTab('review');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : `Failed to fetch ${sourceCode}`);
    }
  }

  function patchDraft(id: string, field: keyof OpportunityDraft, value: string | boolean) {
    setDrafts((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value,
      },
    }));
  }

  async function saveOpportunity(row: Opportunity) {
    const draft = drafts[row.id] ?? {};
    if (Object.keys(draft).length === 0) {
      setSuccess(`No changes to save for ${row.title}`);
      return;
    }

    setError(null);
    setSuccess(null);
    try {
      await clientFetch(`/industry-intelligence/opportunities/${row.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          ...draft,
          tags: draft.tagsText !== undefined ? parseTags(draft.tagsText) : undefined,
        }),
      });
      setSuccess(`Updated ${row.title}`);
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[row.id];
        return next;
      });
      await loadOpportunities();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update opportunity');
    }
  }

  async function quickStatus(row: Opportunity, status: OpportunityStatus) {
    setError(null);
    setSuccess(null);
    try {
      await clientFetch(`/industry-intelligence/opportunities/${row.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setSuccess(`Marked ${row.title} as ${status}`);
      await loadOpportunities();
      await loadMeta();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    }
  }

  async function exportFile(format: 'csv' | 'xlsx') {
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('format', format);
      if (query.trim()) params.set('q', query.trim());
      if (sourceFilter) params.set('source_code', sourceFilter);
      if (categoryFilter) params.set('category', categoryFilter);
      if (sectorFilter.trim()) params.set('sector', sectorFilter.trim());
      if (stageFilter.trim()) params.set('funding_stage', stageFilter.trim());
      if (statusFilter) params.set('status', statusFilter);

      const res = await fetch(`/api/proxy/industry-intelligence/export?${params.toString()}`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Export failed');
      }

      const blob = await res.blob();
      const disposition = res.headers.get('content-disposition') || '';
      const match = disposition.match(/filename="?([^";]+)"?/i);
      const fileName = match?.[1] || `industry-intelligence.${format}`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setSuccess(`Exported ${format.toUpperCase()} successfully.`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to export file');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Funding & Pitch Intelligence</h2>
          <p className="text-sm text-muted-foreground">Fetch and review India tech/agri-tech funding, grant, accelerator, investor, and pitch opportunities.</p>
        </div>
        <div className="flex gap-2">
          <Button variant={activeTab === 'fetch' ? 'default' : 'outline'} onClick={() => setActiveTab('fetch')}>Fetch</Button>
          <Button variant={activeTab === 'review' ? 'default' : 'outline'} onClick={() => setActiveTab('review')}>Review</Button>
        </div>
      </div>

      {error && <div className="rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">{error}</div>}
      {success && <div className="rounded border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-700 dark:text-green-300">{success}</div>}
      {fallbackCatalogActive && (
        <div className="rounded border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-200">
          DB seed missing or unavailable. Showing fallback source catalog.
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-5">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Total</div>
            <div className="text-2xl font-semibold">{summary?.total ?? totalRows}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">New</div>
            <div className="text-2xl font-semibold">{summary?.new_count ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Shortlisted</div>
            <div className="text-2xl font-semibold">{summary?.shortlisted_count ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Applied</div>
            <div className="text-2xl font-semibold">{summary?.applied_count ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Source Health</div>
            <div className="text-2xl font-semibold">{summary?.healthy_sources ?? 0}/{summary?.total_sources ?? sources.length}</div>
          </CardContent>
        </Card>
      </div>

      {activeTab === 'fetch' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Source Matrix</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {sources.map((source) => (
                  <label key={source.id} className="flex items-start gap-3 rounded border p-3">
                    <input
                      type="checkbox"
                      checked={Boolean(selectedSources[source.code])}
                      onChange={(event) => setSelectedSources((prev) => ({ ...prev, [source.code]: event.target.checked }))}
                    />
                    <div className="space-y-1">
                      <div className="font-medium text-sm">{source.name}</div>
                      <div className="text-xs text-muted-foreground">{source.code} · {source.region ?? 'Global'}</div>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="outline">{source.mode}</Badge>
                        {source.supports_fetch && <Badge className="bg-emerald-700">Fetch</Badge>}
                        {source.supports_manual && <Badge variant="secondary">Manual</Badge>}
                        <Badge variant="outline">health: {source.health_status}</Badge>
                      </div>
                    </div>
                  </label>
                ))}
              </div>

              <div className="text-xs text-muted-foreground">
                Selected sources: {chosenSourceCodes.length > 0 ? chosenSourceCodes.join(', ') : 'none'}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void runFetch()} disabled={loading || chosenSourceCodes.length === 0}>Fetch Selected Now</Button>
                <Button variant="outline" onClick={() => {
                  const allSourceCodes = sources.map((source) => source.code);
                  setSelectedSources(Object.fromEntries(allSourceCodes.map((code) => [code, true])));
                  void runFetchForSources(allSourceCodes);
                }} disabled={loading || sources.length === 0}>Fetch All Now</Button>
                <Button variant="outline" onClick={() => void refreshAll()} disabled={loading}>Refresh</Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className={showManualPayload ? '' : 'lg:col-span-2'}>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle>Sources</CardTitle>
                  <Button variant="outline" onClick={() => setShowManualPayload((value) => !value)}>
                    {showManualPayload ? 'Hide Manual Import' : 'Show Manual Import'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {sources.map((source) => (
                  <div key={source.id} className="flex flex-col gap-2 rounded border p-3 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-1">
                      <div className="font-medium text-sm">{source.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {source.code} | {source.mode} | {source.last_success_at ? `Last success ${new Date(source.last_success_at).toLocaleString()}` : 'No successful fetch yet'}
                      </div>
                      {source.source_url && <div className="max-w-xl truncate text-xs text-muted-foreground">{source.source_url}</div>}
                      {source.last_error && <div className="text-xs text-red-700 dark:text-red-300">{source.last_error}</div>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={source.health_status === 'healthy' ? 'default' : 'outline'}>{source.health_status}</Badge>
                      <Button size="sm" variant="outline" onClick={() => void runSourceFetch(source.code)} disabled={loading || !source.supports_fetch}>Fetch</Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {showManualPayload && (
              <Card>
                <CardHeader>
                  <CardTitle>Manual Payload</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea value={manualJson} onChange={(event) => setManualJson(event.target.value)} className="min-h-[300px] font-mono text-xs" />
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Connector Summary</CardTitle>
              </CardHeader>
              <CardContent className="max-h-[340px] space-y-2 overflow-y-auto">
                {latestSourceResults.length === 0 && <div className="text-sm text-muted-foreground">No source summaries yet.</div>}
                {latestSourceResults.map((result, index) => (
                  <div key={`${result.source_code}-${index}`} className="space-y-1 rounded border p-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{result.source_code}</span>
                      <Badge variant="outline">{result.mode}</Badge>
                    </div>
                    <div className="text-muted-foreground">{result.status} | Fetched: {result.fetched_count}, Inserted: {result.inserted_count}, Deduped: {result.deduped_count}, Failed: {result.failed_count}</div>
                    <div className="text-muted-foreground">Latency: {result.latency_ms ?? 0} ms</div>
                    {result.error_message && <div className="text-red-700 dark:text-red-300">{result.error_message}</div>}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent Fetch Runs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {runs.length === 0 && <div className="text-sm text-muted-foreground">No fetch runs yet.</div>}
              {runs.map((run) => (
                <div key={run.id} className="space-y-1 rounded border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium text-sm">{run.source_code ?? 'unknown source'}</div>
                    <Badge variant="outline">{run.status}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Total: {run.total_received} | Inserted: {run.inserted_count} | Deduped: {run.deduped_count} | Failed: {run.failed_count}
                  </div>
                  <div className="text-xs text-muted-foreground">{new Date(run.created_at).toLocaleString()}</div>
                  {run.error_summary && <div className="text-xs text-red-700 dark:text-red-300">{run.error_summary}</div>}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'review' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Review Filters + Export</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
              <Input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search title/source/notes" />
              <select className="rounded-md border border-border bg-background px-3 py-2 text-sm" value={sourceFilter} onChange={(event) => { setSourceFilter(event.target.value); setPage(1); }}>
                <option value="">All Sources</option>
                {sources.map((source) => <option key={source.id} value={source.code}>{source.name}</option>)}
              </select>
              <select className="rounded-md border border-border bg-background px-3 py-2 text-sm" value={categoryFilter} onChange={(event) => { setCategoryFilter(event.target.value); setPage(1); }}>
                <option value="">All Categories</option>
                {CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
              <Input value={sectorFilter} onChange={(event) => { setSectorFilter(event.target.value); setPage(1); }} placeholder="Sector" />
              <Input value={stageFilter} onChange={(event) => { setStageFilter(event.target.value); setPage(1); }} placeholder="Stage" />
              <select className="rounded-md border border-border bg-background px-3 py-2 text-sm" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }}>
                <option value="">All Statuses</option>
                {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
              <Button variant="outline" onClick={() => void exportFile('csv')}>Export CSV</Button>
              <Button variant="outline" onClick={() => void exportFile('xlsx')}>Export XLSX</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Opportunity Queue ({totalRows})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {rows.length === 0 && <div className="text-sm text-muted-foreground">No opportunities found for current filters.</div>}
              {rows.map((row) => {
                const draft = drafts[row.id] ?? {};
                return (
                  <div key={row.id} className="space-y-3 rounded border p-3">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-1">
                        <div className="font-medium">{row.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {row.source_name ?? row.source_code ?? 'Unknown source'} | {row.organizer_or_investor ?? 'No organizer'} | {new Date(row.created_at).toLocaleString()}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {row.amount_text ?? 'Amount not listed'} | {row.funding_stage ?? 'Stage not listed'} | {row.deadline_date ? `Deadline ${new Date(row.deadline_date).toLocaleDateString()}` : 'No deadline'}
                        </div>
                        {row.source_url && (
                          <a className="text-xs text-primary hover:underline" href={row.source_url} target="_blank" rel="noreferrer">
                            {row.source_url}
                          </a>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">{row.category}</Badge>
                        <Badge variant={row.status === 'shortlisted' || row.status === 'applied' ? 'default' : 'outline'}>{row.status}</Badge>
                        <Badge variant="secondary">score {row.relevance_score ?? 0}</Badge>
                      </div>
                    </div>

                    {row.summary && <div className="rounded bg-muted/20 p-2 text-sm">{row.summary}</div>}

                    <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-4">
                      <select className="rounded-md border border-border bg-background px-3 py-2 text-sm" value={String(draft.category ?? row.category)} onChange={(event) => patchDraft(row.id, 'category', event.target.value)}>
                        {CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
                      </select>
                      <select className="rounded-md border border-border bg-background px-3 py-2 text-sm" value={String(draft.status ?? row.status)} onChange={(event) => patchDraft(row.id, 'status', event.target.value)}>
                        {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                      </select>
                      <Input placeholder="Sector" value={String(draft.sector ?? row.sector ?? '')} onChange={(event) => patchDraft(row.id, 'sector', event.target.value)} />
                      <Input placeholder="Stage" value={String(draft.funding_stage ?? row.funding_stage ?? '')} onChange={(event) => patchDraft(row.id, 'funding_stage', event.target.value)} />
                      <Input placeholder="Geography" value={String(draft.geography ?? row.geography ?? '')} onChange={(event) => patchDraft(row.id, 'geography', event.target.value)} />
                      <Input placeholder="Relevance 0-100" value={String(draft.relevance_score ?? row.relevance_score ?? '')} onChange={(event) => patchDraft(row.id, 'relevance_score', event.target.value)} />
                      <Input placeholder="Owner" value={String(draft.owner ?? row.owner ?? '')} onChange={(event) => patchDraft(row.id, 'owner', event.target.value)} />
                      <Input placeholder="Tags CSV" value={String(draft.tagsText ?? (row.tags ?? []).join(', '))} onChange={(event) => patchDraft(row.id, 'tagsText', event.target.value)} />
                    </div>

                    <div className="grid gap-3 md:grid-cols-4">
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={Boolean(draft.useful_for_funding ?? row.useful_for_funding)} onChange={(event) => patchDraft(row.id, 'useful_for_funding', event.target.checked)} />
                        Funding
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={Boolean(draft.useful_for_clients ?? row.useful_for_clients)} onChange={(event) => patchDraft(row.id, 'useful_for_clients', event.target.checked)} />
                        Clients
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={Boolean(draft.useful_for_partnerships ?? row.useful_for_partnerships)} onChange={(event) => patchDraft(row.id, 'useful_for_partnerships', event.target.checked)} />
                        Partnerships
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={Boolean(draft.useful_for_content ?? row.useful_for_content)} onChange={(event) => patchDraft(row.id, 'useful_for_content', event.target.checked)} />
                        Content
                      </label>
                    </div>

                    <Textarea placeholder="Notes" value={String(draft.notes ?? row.notes ?? '')} onChange={(event) => patchDraft(row.id, 'notes', event.target.value)} />

                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => void saveOpportunity(row)}>Save Review</Button>
                      <Button variant="outline" onClick={() => void quickStatus(row, 'shortlisted')}>Shortlist</Button>
                      <Button variant="outline" onClick={() => void quickStatus(row, 'applied')}>Applied</Button>
                      <Button variant="outline" onClick={() => void quickStatus(row, 'not_relevant')}>Not Relevant</Button>
                    </div>
                  </div>
                );
              })}

              <div className="flex items-center justify-between pt-2">
                <div className="text-xs text-muted-foreground">Page {page} of {totalPages}</div>
                <div className="flex gap-2">
                  <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</Button>
                  <Button variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
