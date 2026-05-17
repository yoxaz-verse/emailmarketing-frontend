'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { clientFetch } from '@/lib/client-fetch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

type InquirySource = {
  id: string;
  code: string;
  name: string;
  mode: string;
  status: string;
  source_origin?: 'db' | 'fallback';
  supports_api: boolean;
  supports_webhook: boolean;
  supports_manual: boolean;
  supports_scrape: boolean;
  auth_ready: boolean;
  health_status: string;
};

type Inquiry = {
  id: string;
  inquiry_code: string;
  source_code: string | null;
  buyer_name: string | null;
  buyer_email: string | null;
  buyer_country: string | null;
  message: string;
  product_interest: string | null;
  quantity_band: string | null;
  region: string | null;
  urgency: string | null;
  buyer_type: string | null;
  stage: 'new' | 'reviewed' | 'qualified' | 'follow_up' | 'closed';
  priority: string | null;
  owner: string | null;
  notes: string | null;
  coded: boolean;
  created_at: string;
};

type FetchRun = {
  id: string;
  source_code: string | null;
  status: string;
  total_received: number;
  inserted_count: number;
  deduped_count: number;
  failed_count: number;
  created_at: string;
};

type ConnectorRun = {
  id: string;
  fetch_run_id: string | null;
  source_code: string | null;
  mode: string;
  status: string;
  fetched_count: number;
  inserted_count: number;
  deduped_count: number;
  failed_count: number;
  latency_ms: number | null;
  error_message: string | null;
};

const UI_FALLBACK_SOURCES: InquirySource[] = [
  { id: 'ui-fallback-manual', code: 'manual', name: 'Manual Intake', mode: 'manual_webhook', status: 'active', source_origin: 'fallback', supports_api: false, supports_webhook: true, supports_manual: true, supports_scrape: false, auth_ready: false, health_status: 'fallback' },
  { id: 'ui-fallback-alibaba', code: 'alibaba', name: 'Alibaba RFQ', mode: 'api_webhook_manual', status: 'active', source_origin: 'fallback', supports_api: true, supports_webhook: true, supports_manual: true, supports_scrape: false, auth_ready: false, health_status: 'fallback' },
  { id: 'ui-fallback-tradekey', code: 'tradekey', name: 'TradeKey', mode: 'api_webhook_manual', status: 'active', source_origin: 'fallback', supports_api: true, supports_webhook: true, supports_manual: true, supports_scrape: false, auth_ready: false, health_status: 'fallback' },
  { id: 'ui-fallback-ec21', code: 'ec21', name: 'EC21', mode: 'api_webhook_manual', status: 'active', source_origin: 'fallback', supports_api: true, supports_webhook: true, supports_manual: true, supports_scrape: false, auth_ready: false, health_status: 'fallback' },
  { id: 'ui-fallback-globalsources', code: 'globalsources', name: 'Global Sources', mode: 'manual_webhook', status: 'active', source_origin: 'fallback', supports_api: false, supports_webhook: true, supports_manual: true, supports_scrape: false, auth_ready: false, health_status: 'fallback' },
  { id: 'ui-fallback-indiamart', code: 'indiamart', name: 'IndiaMART', mode: 'api_webhook_manual', status: 'active', source_origin: 'fallback', supports_api: true, supports_webhook: true, supports_manual: true, supports_scrape: false, auth_ready: false, health_status: 'fallback' },
  { id: 'ui-fallback-made_in_china', code: 'made_in_china', name: 'Made-in-China', mode: 'api_webhook_manual', status: 'active', source_origin: 'fallback', supports_api: true, supports_webhook: true, supports_manual: true, supports_scrape: false, auth_ready: false, health_status: 'fallback' },
  { id: 'ui-fallback-exportersindia', code: 'exportersindia', name: 'ExportersIndia', mode: 'manual_webhook', status: 'active', source_origin: 'fallback', supports_api: false, supports_webhook: true, supports_manual: true, supports_scrape: false, auth_ready: false, health_status: 'fallback' },
  { id: 'ui-fallback-go4worldbusiness', code: 'go4worldbusiness', name: 'Go4WorldBusiness', mode: 'manual_webhook', status: 'active', source_origin: 'fallback', supports_api: false, supports_webhook: true, supports_manual: true, supports_scrape: false, auth_ready: false, health_status: 'fallback' },
  { id: 'ui-fallback-ecplaza', code: 'ecplaza', name: 'ECPlaza', mode: 'manual_webhook', status: 'active', source_origin: 'fallback', supports_api: false, supports_webhook: true, supports_manual: true, supports_scrape: false, auth_ready: false, health_status: 'fallback' },
];

const STAGES = ['new', 'reviewed', 'qualified', 'follow_up', 'closed'] as const;

const EXAMPLE_JSON = JSON.stringify(
  [
    {
      source_external_id: 'RFQ-1001',
      buyer_name: 'Ali Trade LLC',
      buyer_email: 'procurement@alitrade.com',
      buyer_country: 'UAE',
      subject: 'Need Yellow Maize',
      message: 'Urgent need 500 MT yellow maize CIF Jebel Ali within 2 weeks',
      quantity_requested: '500 MT',
      product_interest: 'Yellow Maize',
    },
  ],
  null,
  2
);

export default function InquiryFetchingClient() {
  const [activeTab, setActiveTab] = useState<'fetching' | 'coding'>('fetching');
  const [sources, setSources] = useState<InquirySource[]>([]);
  const [selectedSources, setSelectedSources] = useState<Record<string, boolean>>({});
  const [runs, setRuns] = useState<FetchRun[]>([]);
  const [connectorRuns, setConnectorRuns] = useState<ConnectorRun[]>([]);
  const [rows, setRows] = useState<Inquiry[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [codedFilter, setCodedFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);

  const [manualJson, setManualJson] = useState(EXAMPLE_JSON);
  const [codingDraft, setCodingDraft] = useState<Record<string, Partial<Inquiry>>>({});

  const totalPages = useMemo(() => Math.max(1, Math.ceil(totalRows / pageSize)), [totalRows, pageSize]);
  const fallbackCatalogActive = useMemo(
    () => sources.some((source) => source.source_origin === 'fallback'),
    [sources]
  );
  const chosenSourceCodes = useMemo(
    () => Object.entries(selectedSources).filter(([, v]) => v).map(([code]) => code),
    [selectedSources]
  );

  const loadMeta = useCallback(async () => {
    const [sourceData, runData, connectorData] = await Promise.all([
      clientFetch<InquirySource[]>('/inquiries/sources'),
      clientFetch<FetchRun[]>('/inquiries/fetch-runs?limit=20'),
      clientFetch<ConnectorRun[]>('/inquiries/connector-runs?limit=100'),
    ]);
    const sourceRows = (sourceData ?? []).length > 0 ? (sourceData ?? []) : UI_FALLBACK_SOURCES;
    const sortedSources = sourceRows.sort((a, b) => a.name.localeCompare(b.name));
    setSources(sortedSources);
    setSelectedSources((prev) => {
      const next: Record<string, boolean> = {};
      for (const source of sortedSources) {
        next[source.code] = prev[source.code] ?? ['manual', 'alibaba', 'indiamart'].includes(source.code);
      }
      return next;
    });
    setRuns(runData ?? []);
    setConnectorRuns(connectorData ?? []);
  }, []);

  const loadInquiries = useCallback(async () => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('page_size', String(pageSize));
    if (query.trim()) params.set('q', query.trim());
    if (sourceFilter) params.set('source_code', sourceFilter);
    if (stageFilter) params.set('stage', stageFilter);
    if (codedFilter) params.set('coded', codedFilter);

    const response = await clientFetch<{ rows: Inquiry[]; total: number }>(`/inquiries?${params.toString()}`);
    setRows(response.rows ?? []);
    setTotalRows(Number(response.total ?? 0));
  }, [page, pageSize, query, sourceFilter, stageFilter, codedFilter]);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([loadMeta(), loadInquiries()]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load inquiry module data');
    } finally {
      setLoading(false);
    }
  }, [loadMeta, loadInquiries]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    void loadInquiries();
  }, [loadInquiries]);

  async function handleSingleManualFetch(sourceCode: string) {
    const parsed = JSON.parse(manualJson);
    if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('Manual JSON must be a non-empty array');
    return clientFetch<{ summary: { total_received: number; inserted_count: number; deduped_count: number; failed_count: number } }>(
      '/inquiries/fetch-runs',
      {
        method: 'POST',
        body: JSON.stringify({ source_code: sourceCode, items: parsed }),
      }
    );
  }

  async function handleMultiSourceFetch() {
    setError(null);
    setSuccess(null);
    try {
      if (chosenSourceCodes.length === 0) throw new Error('Select at least one source to run fetch');
      const manualOnly = chosenSourceCodes.length === 1 && chosenSourceCodes[0] === 'manual';

      let result: { summary: { source_count?: number; total_received: number; inserted_count: number; deduped_count: number; failed_count: number } };

      if (manualOnly) {
        result = await handleSingleManualFetch('manual');
      } else {
        result = await clientFetch('/inquiries/fetch-runs', {
          method: 'POST',
          body: JSON.stringify({ source_codes: chosenSourceCodes }),
        });
      }

      const s = result.summary;
      setSuccess(
        `Fetch completed. Sources: ${s.source_count ?? chosenSourceCodes.length}, Total: ${s.total_received}, Inserted: ${s.inserted_count}, Deduped: ${s.deduped_count}, Failed: ${s.failed_count}`
      );
      await refreshAll();
      setActiveTab('coding');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to process fetch request');
    }
  }

  function patchDraft(id: string, field: keyof Inquiry, value: string) {
    setCodingDraft((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value,
      },
    }));
  }

  async function saveCoding(row: Inquiry) {
    const patch = codingDraft[row.id] ?? {};
    if (Object.keys(patch).length === 0) {
      setSuccess(`No changes to save for ${row.inquiry_code}`);
      return;
    }

    setError(null);
    setSuccess(null);
    try {
      await clientFetch(`/inquiries/${row.id}/coding`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });

      setSuccess(`Coding updated for ${row.inquiry_code}`);
      setCodingDraft((prev) => {
        const next = { ...prev };
        delete next[row.id];
        return next;
      });
      await loadInquiries();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save coding changes');
    }
  }

  async function exportFile(format: 'csv' | 'xlsx') {
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('format', format);
      if (query.trim()) params.set('q', query.trim());
      if (sourceFilter) params.set('source_code', sourceFilter);
      if (stageFilter) params.set('stage', stageFilter);
      if (codedFilter) params.set('coded', codedFilter);

      const res = await fetch(`/api/proxy/inquiries/export?${params.toString()}`, {
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
      const fileName = match?.[1] || `inquiries.${format}`;
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
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Inquiry Fetching</h2>
          <p className="text-sm text-muted-foreground">Fetch inquiries from multiple websites (API/Webhook/Manual), then code and export them.</p>
        </div>
        <div className="flex gap-2">
          <Button variant={activeTab === 'fetching' ? 'default' : 'outline'} onClick={() => setActiveTab('fetching')}>Fetching</Button>
          <Button variant={activeTab === 'coding' ? 'default' : 'outline'} onClick={() => setActiveTab('coding')}>Coding</Button>
        </div>
      </div>

      {error && <div className="rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}
      {success && <div className="rounded border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-300">{success}</div>}
      {fallbackCatalogActive && (
        <div className="rounded border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
          DB seed missing or unavailable. Showing fallback source catalog.
        </div>
      )}

      {activeTab === 'fetching' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Source Matrix</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {sources.map((source) => (
                  <label key={source.id} className="rounded border p-3 flex gap-3 items-start">
                    <input
                      type="checkbox"
                      checked={Boolean(selectedSources[source.code])}
                      onChange={(e) => setSelectedSources((prev) => ({ ...prev, [source.code]: e.target.checked }))}
                    />
                    <div className="space-y-1">
                      <div className="font-medium text-sm">{source.name}</div>
                      <div className="text-xs text-muted-foreground">{source.code}</div>
                      <div className="flex flex-wrap gap-1">
                        {source.supports_api && <Badge className="bg-emerald-700">API</Badge>}
                        {source.supports_webhook && <Badge className="bg-cyan-700">Webhook</Badge>}
                        {source.supports_manual && <Badge variant="secondary">Manual</Badge>}
                        {source.supports_scrape && <Badge className="bg-amber-700">Scrape</Badge>}
                        <Badge variant="outline">health: {source.health_status}</Badge>
                      </div>
                    </div>
                  </label>
                ))}
              </div>

              <div className="text-xs text-muted-foreground">
                Selected sources: {chosenSourceCodes.length > 0 ? chosenSourceCodes.join(', ') : 'none'}
              </div>

              <div className="flex gap-2">
                <Button onClick={() => void handleMultiSourceFetch()} disabled={loading || chosenSourceCodes.length === 0}>Run Multi-Source Fetch</Button>
                <Button variant="outline" onClick={() => void refreshAll()} disabled={loading}>Refresh</Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Manual Payload (used when only manual source is selected)</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea value={manualJson} onChange={(e) => setManualJson(e.target.value)} className="min-h-[280px] font-mono text-xs" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Connector Run Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-[320px] overflow-y-auto">
                {connectorRuns.length === 0 && <div className="text-sm text-muted-foreground">No connector runs yet.</div>}
                {connectorRuns.map((run) => (
                  <div key={run.id} className="rounded border p-2 text-xs space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{run.source_code}</span>
                      <Badge variant="outline">{run.mode}</Badge>
                    </div>
                    <div className="text-muted-foreground">{run.status} | Fetched: {run.fetched_count}, Inserted: {run.inserted_count}, Deduped: {run.deduped_count}, Failed: {run.failed_count}</div>
                    <div className="text-muted-foreground">Latency: {run.latency_ms ?? 0} ms</div>
                    {run.error_message && <div className="text-red-300">{run.error_message}</div>}
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
                <div key={run.id} className="rounded border p-3 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium text-sm">{run.source_code ?? 'unknown source'}</div>
                    <Badge variant="outline">{run.status}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Total: {run.total_received} | Inserted: {run.inserted_count} | Deduped: {run.deduped_count} | Failed: {run.failed_count}
                  </div>
                  <div className="text-xs text-muted-foreground">{new Date(run.created_at).toLocaleString()}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'coding' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Coding Filters + Export</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-6">
              <Input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="Search inquiry/buyer/message" />
              <select className="rounded-md border border-border bg-background px-3 py-2 text-sm" value={sourceFilter} onChange={(e) => { setSourceFilter(e.target.value); setPage(1); }}>
                <option value="">All Sources</option>
                {sources.map((source) => <option key={source.id} value={source.code}>{source.name}</option>)}
              </select>
              <select className="rounded-md border border-border bg-background px-3 py-2 text-sm" value={stageFilter} onChange={(e) => { setStageFilter(e.target.value); setPage(1); }}>
                <option value="">All Stages</option>
                {STAGES.map((stage) => <option key={stage} value={stage}>{stage}</option>)}
              </select>
              <select className="rounded-md border border-border bg-background px-3 py-2 text-sm" value={codedFilter} onChange={(e) => { setCodedFilter(e.target.value); setPage(1); }}>
                <option value="">All Coding</option>
                <option value="true">Coded</option>
                <option value="false">Not Coded</option>
              </select>
              <Button variant="outline" onClick={() => void exportFile('csv')}>Export CSV</Button>
              <Button variant="outline" onClick={() => void exportFile('xlsx')}>Export XLSX</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Coding Queue ({totalRows})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {rows.length === 0 && <div className="text-sm text-muted-foreground">No inquiries found for current filters.</div>}
              {rows.map((row) => {
                const draft = codingDraft[row.id] ?? {};
                return (
                  <div key={row.id} className="rounded border p-3 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="font-medium">{row.inquiry_code} - {row.buyer_name ?? 'Unknown Buyer'}</div>
                        <div className="text-xs text-muted-foreground">{row.source_code ?? 'unknown source'} | {row.buyer_email ?? 'No email'} | {new Date(row.created_at).toLocaleString()}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={row.coded ? 'default' : 'outline'}>{row.coded ? 'coded' : 'not coded'}</Badge>
                        <Badge variant="outline">{row.stage}</Badge>
                      </div>
                    </div>

                    <div className="text-sm rounded bg-muted/20 p-2">{row.message}</div>

                    <div className="grid gap-2 md:grid-cols-3">
                      <Input placeholder="Product Interest" value={String(draft.product_interest ?? row.product_interest ?? '')} onChange={(e) => patchDraft(row.id, 'product_interest', e.target.value)} />
                      <Input placeholder="Quantity Band" value={String(draft.quantity_band ?? row.quantity_band ?? '')} onChange={(e) => patchDraft(row.id, 'quantity_band', e.target.value)} />
                      <Input placeholder="Region" value={String(draft.region ?? row.region ?? '')} onChange={(e) => patchDraft(row.id, 'region', e.target.value)} />
                      <Input placeholder="Urgency" value={String(draft.urgency ?? row.urgency ?? '')} onChange={(e) => patchDraft(row.id, 'urgency', e.target.value)} />
                      <Input placeholder="Buyer Type" value={String(draft.buyer_type ?? row.buyer_type ?? '')} onChange={(e) => patchDraft(row.id, 'buyer_type', e.target.value)} />
                      <select className="rounded-md border border-border bg-background px-3 py-2 text-sm" value={String(draft.stage ?? row.stage ?? 'new')} onChange={(e) => patchDraft(row.id, 'stage', e.target.value)}>
                        {STAGES.map((stage) => <option key={stage} value={stage}>{stage}</option>)}
                      </select>
                      <Input placeholder="Priority" value={String(draft.priority ?? row.priority ?? '')} onChange={(e) => patchDraft(row.id, 'priority', e.target.value)} />
                      <Input placeholder="Owner" value={String(draft.owner ?? row.owner ?? '')} onChange={(e) => patchDraft(row.id, 'owner', e.target.value)} />
                      <Input placeholder="Notes" value={String(draft.notes ?? row.notes ?? '')} onChange={(e) => patchDraft(row.id, 'notes', e.target.value)} />
                    </div>

                    <div>
                      <Button onClick={() => void saveCoding(row)}>Save Coding</Button>
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
