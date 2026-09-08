'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Check, Download, ExternalLink, Filter, Pause, Play, RefreshCw, Search, Settings2, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { clientFetch } from '@/lib/client-fetch';
import { cn } from '@/lib/utils';

type EventScope = 'international' | 'india' | 'kerala' | 'district';
type ProviderType = 'rss' | 'ics' | 'api' | 'html';
type EventStatus = 'discovered' | 'planned' | 'ignored' | 'expired';

type EventSource = {
  id: string;
  source_name: string;
  provider_type: ProviderType;
  source_url: string;
  geography_scope: EventScope;
  country: string | null;
  state: string | null;
  district: string | null;
  categories: string[];
  parser_key: string | null;
  trust_score: number | null;
  polling_interval_minutes: number | null;
  active: boolean;
  last_ingested_at: string | null;
  last_checked_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
  health_status: 'unknown' | 'healthy' | 'error';
};

type EventItem = {
  id: string;
  source_id: string | null;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  timezone: string | null;
  location: string | null;
  geography_scope: EventScope;
  country: string | null;
  state: string | null;
  district: string | null;
  category: string | null;
  source_url: string | null;
  source_snapshot: Record<string, unknown>;
  status: EventStatus;
  planning_notes: string | null;
  countdown_meta?: { label?: string; days_until?: number; ms_until?: number };
  event_sources?: { source_name?: string; provider_type?: ProviderType } | null;
};

type EventListResponse = {
  rows: EventItem[];
  total: number;
  page: number;
  page_size: number;
};

type IngestionSummary = {
  processed_sources: number;
  processed_count: number;
  inserted_count: number;
  skipped_count: number;
  error_count: number;
  source_results?: SourceResult[];
};

type SourceResult = {
  ok: boolean;
  source_id: string;
  source_name: string;
  source_url: string;
  provider_type: ProviderType;
  parser_key: string | null;
  http_status: number | null;
  fetched_count: number;
  error_code: string | null;
  error_message: string | null;
  suggested_action: string | null;
};

type EventIngestionRun = {
  id: string;
  source_id: string | null;
  status: 'success' | 'partial' | 'failed';
  processed_count: number;
  inserted_count: number;
  skipped_count: number;
  error_count: number;
  metadata: SourceResult | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  event_sources?: { source_name?: string; provider_type?: ProviderType } | null;
};

const SCOPE_OPTIONS: Array<{ value: '' | EventScope; label: string }> = [
  { value: '', label: 'All scopes' },
  { value: 'international', label: 'International' },
  { value: 'india', label: 'India' },
  { value: 'kerala', label: 'Kerala' },
  { value: 'district', label: 'District' },
];

const STATUS_OPTIONS: Array<{ value: '' | EventStatus; label: string }> = [
  { value: '', label: 'Active' },
  { value: 'discovered', label: 'Discovered' },
  { value: 'planned', label: 'Planned' },
  { value: 'ignored', label: 'Ignored' },
  { value: 'expired', label: 'Expired' },
];

const CATEGORY_PRESETS = [
  { label: 'AgriTech', value: 'agritech' },
  { label: 'Startup', value: 'startup' },
  { label: 'AI', value: 'ai' },
  { label: 'Food Export', value: 'food export' },
];

const PARSER_OPTIONS = [
  'generic_html_events',
  'apeda_trade_fairs',
  'tpci_forthcoming_events',
  'cii_events',
  'cii_trade_fairs',
  'aishala_events',
  'tradefairdates_agriculture_india',
  'agrotech_india_events',
  'spices_board_trade_fairs',
  'ksum_events',
  'startup_india_challenges',
  'indiaai_events',
  'generic_trade_fair_events',
];

function parseCsv(input: string): string[] {
  return Array.from(new Set(input.split(',').map((item) => item.trim()).filter(Boolean)));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatOptionalDateTime(value: string | null) {
  if (!value) return 'Not refreshed yet';
  return formatDateTime(value);
}

function describeSourceError(value: string | null | undefined): string | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const code = raw.match(/^source_fetch_(\d{3})$/)?.[1];
  if (code === '401') return 'Source requires authentication. Use a public feed/API/calendar URL or pause it.';
  if (code === '403') return 'Source blocked server access. Try RSS/API/calendar or pause it.';
  if (code === '404') return 'Source URL was not found. Check the URL or disable this source.';
  if (code === '429') return 'Source rate-limited requests. Increase polling interval and retry later.';
  if (/getaddrinfo|enotfound|dns/i.test(raw)) return 'Source host could not be resolved. Check the domain name.';
  return raw;
}

function statusBadge(status: EventStatus) {
  if (status === 'planned') return <Badge className="bg-green-600">Planned</Badge>;
  if (status === 'ignored') return <Badge variant="secondary">Ignored</Badge>;
  if (status === 'expired') return <Badge variant="outline">Expired</Badge>;
  return <Badge className="bg-blue-600">Discovered</Badge>;
}

function scopeLabel(event: EventItem) {
  const pieces = [event.geography_scope, event.country, event.state, event.district]
    .map((item) => String(item ?? '').trim())
    .filter(Boolean);
  return pieces.join(' / ');
}

function buildQuery(filters: {
  scope: string;
  country: string;
  state: string;
  district: string;
  category: string;
  source_id: string;
  status: string;
  days: string;
}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (String(value || '').trim()) query.set(key, String(value).trim());
  }
  query.set('page_size', '100');
  return query.toString();
}

export default function EventsIntelligenceClient() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [sources, setSources] = useState<EventSource[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [ingesting, setIngesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastIngestion, setLastIngestion] = useState<IngestionSummary | null>(null);
  const [runs, setRuns] = useState<EventIngestionRun[]>([]);
  const [selectedSourceIds, setSelectedSourceIds] = useState<Record<string, boolean>>({});
  const [showSourceManager, setShowSourceManager] = useState(false);

  const [filters, setFilters] = useState({
    scope: '',
    country: '',
    state: '',
    district: '',
    category: '',
    source_id: '',
    status: '',
    days: '30',
  });

  const [sourceForm, setSourceForm] = useState({
    id: '',
    source_name: '',
    provider_type: 'rss' as ProviderType,
    source_url: '',
    geography_scope: 'international' as EventScope,
    country: '',
    state: '',
    district: '',
    categories_csv: '',
    parser_key: '',
    trust_score: '0.7',
    polling_interval_minutes: '360',
    active: true,
  });

  const [planningNotes, setPlanningNotes] = useState('');

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) ?? events[0] ?? null,
    [events, selectedEventId]
  );

  const plannedCount = useMemo(() => events.filter((event) => event.status === 'planned').length, [events]);
  const activeSources = useMemo(() => sources.filter((source) => source.active), [sources]);
  const chosenSourceIds = useMemo(
    () => Object.entries(selectedSourceIds).filter(([, selected]) => selected).map(([id]) => id),
    [selectedSourceIds]
  );
  const latestSourceResults = useMemo(
    () => lastIngestion?.source_results ?? (runs.map((run) => run.metadata).filter(Boolean).slice(0, 8) as SourceResult[]),
    [lastIngestion?.source_results, runs]
  );
  const nextSevenCount = useMemo(() => {
    const now = Date.now();
    const limit = now + 7 * 86_400_000;
    return events.filter((event) => {
      const starts = new Date(event.starts_at).getTime();
      return starts >= now && starts <= limit && event.status !== 'ignored';
    }).length;
  }, [events]);

  const refreshAll = async (nextFilters = filters) => {
    setLoading(true);
    setError(null);
    try {
      const query = buildQuery(nextFilters);
      const [eventData, sourceData, runData] = await Promise.all([
        clientFetch<EventListResponse>(`/events?${query}`),
        clientFetch<EventSource[]>('/events/sources'),
        clientFetch<EventIngestionRun[]>('/events/ingest/runs'),
      ]);
      setEvents(eventData.rows || []);
      setSources(sourceData || []);
      setRuns(runData || []);
      setSelectedSourceIds((prev) => {
        const next = { ...prev };
        for (const source of sourceData || []) {
          if (source.active && next[source.id] === undefined) next[source.id] = true;
          if (!source.active) delete next[source.id];
        }
        return next;
      });
      if (eventData.rows?.length && !selectedEventId) setSelectedEventId(eventData.rows[0].id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshAll();
  }, []);

  const applyFilters = async () => {
    await refreshAll(filters);
  };

  const applyCategoryPreset = async (category: string) => {
    const nextFilters = { ...filters, category };
    setFilters(nextFilters);
    await refreshAll(nextFilters);
  };

  const resetSourceForm = () => {
    setSourceForm({
      id: '',
      source_name: '',
      provider_type: 'rss',
      source_url: '',
      geography_scope: 'international',
      country: '',
      state: '',
      district: '',
      categories_csv: '',
      parser_key: '',
      trust_score: '0.7',
      polling_interval_minutes: '360',
      active: true,
    });
  };

  const editSource = (source: EventSource) => {
    setShowSourceManager(true);
    setSourceForm({
      id: source.id,
      source_name: source.source_name,
      provider_type: source.provider_type,
      source_url: source.source_url,
      geography_scope: source.geography_scope,
      country: source.country ?? '',
      state: source.state ?? '',
      district: source.district ?? '',
      categories_csv: (source.categories ?? []).join(', '),
      parser_key: source.parser_key ?? '',
      trust_score: String(source.trust_score ?? 0.7),
      polling_interval_minutes: String(source.polling_interval_minutes ?? 360),
      active: source.active,
    });
  };

  const saveSource = async () => {
    try {
      setError(null);
      const payload = {
        source_name: sourceForm.source_name.trim(),
        provider_type: sourceForm.provider_type,
        source_url: sourceForm.source_url.trim(),
        geography_scope: sourceForm.geography_scope,
        country: sourceForm.country.trim() || null,
        state: sourceForm.state.trim() || null,
        district: sourceForm.district.trim() || null,
        categories: parseCsv(sourceForm.categories_csv),
        parser_key: sourceForm.provider_type === 'html' ? (sourceForm.parser_key || 'generic_html_events') : null,
        trust_score: Number(sourceForm.trust_score) || 0.7,
        polling_interval_minutes: Number(sourceForm.polling_interval_minutes) || 360,
        active: sourceForm.active,
      };
      await clientFetch(sourceForm.id ? `/events/sources/${sourceForm.id}` : '/events/sources', {
        method: sourceForm.id ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      });
      resetSourceForm();
      await refreshAll();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save source');
    }
  };

  const runIngestion = async (sourceIds = chosenSourceIds) => {
    try {
      setIngesting(true);
      setError(null);
      const summary = await clientFetch<IngestionSummary>('/events/ingest/run', {
        method: 'POST',
        body: JSON.stringify({
          source_ids: sourceIds.length > 0 ? sourceIds : activeSources.map((source) => source.id),
        }),
      });
      setLastIngestion(summary);
      await refreshAll();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to refresh event sources');
    } finally {
      setIngesting(false);
    }
  };

  const testSource = async (source: EventSource) => {
    try {
      setError(null);
      const result = await clientFetch<SourceResult>(`/events/sources/${source.id}/test`, { method: 'POST', timeoutMs: 30_000 });
      if (!result.ok) setError(result.error_message || result.suggested_action || `Failed to test ${source.source_name}`);
      await refreshAll();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : `Failed to test ${source.source_name}`);
    }
  };

  const setSourceActive = async (source: EventSource, active: boolean) => {
    try {
      setError(null);
      await clientFetch(`/events/sources/${source.id}/${active ? 'activate' : 'pause'}`, { method: 'POST' });
      await refreshAll();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : `Failed to update ${source.source_name}`);
    }
  };

  const exportEventsFile = (format: 'csv' | 'xlsx') => {
    const query = buildQuery({ ...filters, days: filters.days || '365' });
    window.location.href = `/api/proxy/events/export?${query}&format=${format}`;
  };

  const updateEvent = async (eventId: string, status: EventStatus, notes?: string | null) => {
    try {
      setSavingId(eventId);
      setError(null);
      await clientFetch(`/events/${eventId}${status === 'planned' ? '/save' : ''}`, {
        method: status === 'planned' ? 'POST' : 'PATCH',
        body: JSON.stringify(status === 'planned' ? { planning_notes: notes ?? null } : { status, planning_notes: notes ?? null }),
      });
      await refreshAll();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update event');
    } finally {
      setSavingId(null);
    }
  };

  useEffect(() => {
    setPlanningNotes(selectedEvent?.planning_notes ?? '');
  }, [selectedEvent?.id, selectedEvent?.planning_notes]);

  return (
    <main className="min-h-screen bg-background p-4 md:p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarClock className="h-4 w-4" />
              Marketing
            </div>
            <h1 className="text-2xl font-semibold tracking-normal text-foreground">Events Intelligence</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Upcoming events for campaign planning across international, India, Kerala, and district scopes.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void refreshAll()} disabled={loading}>
              <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />
              Reload
            </Button>
            <Button variant="outline" onClick={() => exportEventsFile('csv')}>
              <Download className="mr-2 h-4 w-4" />
              CSV
            </Button>
            <Button variant="outline" onClick={() => exportEventsFile('xlsx')}>
              <Download className="mr-2 h-4 w-4" />
              XLSX
            </Button>
            <Button variant="outline" onClick={() => setShowSourceManager((value) => !value)}>
              <Settings2 className="mr-2 h-4 w-4" />
              Sources
            </Button>
            <Button onClick={() => void runIngestion()} disabled={ingesting || activeSources.length === 0}>
              <RefreshCw className={cn('mr-2 h-4 w-4', ingesting && 'animate-spin')} />
              Scrape Selected
            </Button>
          </div>
        </div>

        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <section className="grid gap-3 md:grid-cols-4">
          <div className="rounded-md border bg-card p-4">
            <p className="text-xs font-medium uppercase text-muted-foreground">Visible Events</p>
            <p className="mt-2 text-2xl font-semibold">{events.length}</p>
          </div>
          <div className="rounded-md border bg-card p-4">
            <p className="text-xs font-medium uppercase text-muted-foreground">Next 7 Days</p>
            <p className="mt-2 text-2xl font-semibold">{nextSevenCount}</p>
          </div>
          <div className="rounded-md border bg-card p-4">
            <p className="text-xs font-medium uppercase text-muted-foreground">Planned</p>
            <p className="mt-2 text-2xl font-semibold">{plannedCount}</p>
          </div>
          <div className="rounded-md border bg-card p-4">
            <p className="text-xs font-medium uppercase text-muted-foreground">Sources</p>
            <p className="mt-2 text-2xl font-semibold">{sources.length}</p>
          </div>
        </section>

        {lastIngestion && (
          <div className="rounded-md border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            Last refresh: {lastIngestion.processed_sources} sources, {lastIngestion.inserted_count} new events,
            {' '}{lastIngestion.skipped_count} skipped, {lastIngestion.error_count} errors.
          </div>
        )}

        <section className="rounded-md border bg-card p-4">
          <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-sm font-semibold">Source Matrix</h2>
              <p className="text-xs text-muted-foreground">
                Selected sources: {chosenSourceIds.length} of {activeSources.length} active
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSelectedSourceIds(Object.fromEntries(activeSources.map((source) => [source.id, true])))}
                disabled={activeSources.length === 0}
              >
                Select All
              </Button>
              <Button size="sm" variant="outline" onClick={() => setSelectedSourceIds({})}>
                Clear
              </Button>
            </div>
          </div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {activeSources.map((source) => (
              <label key={source.id} className="flex min-h-[88px] items-start gap-3 rounded-md border p-3 text-sm">
                <input
                  className="mt-1"
                  type="checkbox"
                  checked={Boolean(selectedSourceIds[source.id])}
                  onChange={(event) => setSelectedSourceIds((prev) => ({ ...prev, [source.id]: event.target.checked }))}
                />
                <span className="min-w-0 space-y-1">
                  <span className="block truncate font-medium">{source.source_name}</span>
                  <span className="block text-xs text-muted-foreground">{source.provider_type} | {source.health_status ?? 'unknown'}</span>
                  {source.last_error && <span className="block text-xs text-destructive">{describeSourceError(source.last_error)}</span>}
                </span>
              </label>
            ))}
          </div>
          {latestSourceResults.length > 0 && (
            <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
              {latestSourceResults.slice(0, 8).map((result, index) => (
                <div key={`${result.source_id}-${index}`} className="rounded-md border p-3 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">{result.source_name}</span>
                    <Badge variant={result.ok ? 'default' : 'destructive'}>{result.ok ? 'ok' : 'error'}</Badge>
                  </div>
                  <div className="mt-1 text-muted-foreground">
                    Fetched {result.fetched_count} {result.http_status ? `| HTTP ${result.http_status}` : ''}
                  </div>
                  {result.error_message && <div className="mt-1 text-destructive">{result.error_message}</div>}
                  {result.suggested_action && <div className="mt-1 text-muted-foreground">{result.suggested_action}</div>}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-md border bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Filters</h2>
          </div>
          <div className="mb-3 flex flex-wrap gap-2">
            {CATEGORY_PRESETS.map((preset) => (
              <Button
                key={preset.value}
                size="sm"
                variant={filters.category === preset.value ? 'default' : 'outline'}
                onClick={() => void applyCategoryPreset(preset.value)}
              >
                {preset.label}
              </Button>
            ))}
            {filters.category && (
              <Button size="sm" variant="ghost" onClick={() => void applyCategoryPreset('')}>
                Clear
              </Button>
            )}
          </div>
          <div className="grid gap-3 md:grid-cols-4 lg:grid-cols-8">
            <select className="h-9 rounded-md border bg-background px-3 text-sm" value={filters.scope} onChange={(e) => setFilters((v) => ({ ...v, scope: e.target.value }))}>
              {SCOPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <select className="h-9 rounded-md border bg-background px-3 text-sm" value={filters.days} onChange={(e) => setFilters((v) => ({ ...v, days: e.target.value }))}>
              <option value="7">Next 7 days</option>
              <option value="30">Next 30 days</option>
              <option value="90">Next 90 days</option>
              <option value="365">Next 365 days</option>
            </select>
            <select className="h-9 rounded-md border bg-background px-3 text-sm" value={filters.status} onChange={(e) => setFilters((v) => ({ ...v, status: e.target.value }))}>
              {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <select className="h-9 rounded-md border bg-background px-3 text-sm" value={filters.source_id} onChange={(e) => setFilters((v) => ({ ...v, source_id: e.target.value }))}>
              <option value="">All sources</option>
              {sources.map((source) => <option key={source.id} value={source.id}>{source.source_name}</option>)}
            </select>
            <Input placeholder="Country" value={filters.country} onChange={(e) => setFilters((v) => ({ ...v, country: e.target.value }))} />
            <Input placeholder="State" value={filters.state} onChange={(e) => setFilters((v) => ({ ...v, state: e.target.value }))} />
            <Input placeholder="District" value={filters.district} onChange={(e) => setFilters((v) => ({ ...v, district: e.target.value }))} />
            <Input placeholder="Category" value={filters.category} onChange={(e) => setFilters((v) => ({ ...v, category: e.target.value }))} />
            <Button variant="outline" onClick={() => void applyFilters()}>
              <Search className="mr-2 h-4 w-4" />
              Apply
            </Button>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-3">
            {loading ? (
              <div className="rounded-md border bg-card p-8 text-sm text-muted-foreground">Loading upcoming events...</div>
            ) : events.length === 0 ? (
              <div className="rounded-md border bg-card p-8 text-sm text-muted-foreground">
                No upcoming events match these filters. Add a source or refresh existing sources.
              </div>
            ) : (
              events.map((event) => (
                <Card key={event.id} className={cn('cursor-pointer rounded-md', selectedEvent?.id === event.id && 'ring-2 ring-primary/30')} onClick={() => setSelectedEventId(event.id)}>
                  <CardContent className="p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {statusBadge(event.status)}
                          <Badge variant="outline">{event.countdown_meta?.label ?? 'Upcoming'}</Badge>
                          {event.category && <Badge variant="secondary">{event.category}</Badge>}
                        </div>
                        <h2 className="mt-2 text-lg font-semibold tracking-normal">{event.title}</h2>
                        <p className="mt-1 text-sm text-muted-foreground">{formatDateTime(event.starts_at)}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{scopeLabel(event) || 'No geography set'}</p>
                      </div>
                      <div className="flex flex-wrap gap-2 md:justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={savingId === event.id || event.status === 'planned'}
                          onClick={(e) => {
                            e.stopPropagation();
                            void updateEvent(event.id, 'planned', event.planning_notes ?? '');
                          }}
                        >
                          <Check className="mr-2 h-4 w-4" />
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={savingId === event.id || event.status === 'ignored'}
                          onClick={(e) => {
                            e.stopPropagation();
                            void updateEvent(event.id, 'ignored', event.planning_notes ?? '');
                          }}
                        >
                          <X className="mr-2 h-4 w-4" />
                          Ignore
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          <aside className="space-y-4">
            <Card className="rounded-md">
              <CardHeader>
                <CardTitle className="text-base">Event Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedEvent ? (
                  <>
                    <div>
                      <h3 className="font-semibold">{selectedEvent.title}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{formatDateTime(selectedEvent.starts_at)}</p>
                    </div>
                    <div className="space-y-1 text-sm">
                      <p><span className="font-medium">Location:</span> {selectedEvent.location || 'Not specified'}</p>
                      <p><span className="font-medium">Source:</span> {selectedEvent.event_sources?.source_name || 'Unknown source'}</p>
                      <p><span className="font-medium">Scope:</span> {scopeLabel(selectedEvent) || 'Not specified'}</p>
                    </div>
                    {selectedEvent.description && <p className="text-sm text-muted-foreground">{selectedEvent.description}</p>}
                    {selectedEvent.source_url && (
                      <a className="inline-flex items-center gap-2 text-sm font-medium text-primary" href={selectedEvent.source_url} target="_blank" rel="noreferrer">
                        Source link <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                    <Textarea
                      placeholder="Planning notes"
                      value={planningNotes}
                      onChange={(e) => setPlanningNotes(e.target.value)}
                      rows={4}
                    />
                    <div className="flex gap-2">
                      <Button className="flex-1" disabled={savingId === selectedEvent.id} onClick={() => void updateEvent(selectedEvent.id, 'planned', planningNotes)}>
                        <Check className="mr-2 h-4 w-4" />
                        Save Plan
                      </Button>
                      <Button variant="outline" disabled={savingId === selectedEvent.id} onClick={() => void updateEvent(selectedEvent.id, 'ignored', planningNotes)}>
                        Ignore
                      </Button>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Select an event to inspect it.</p>
                )}
              </CardContent>
            </Card>

            {showSourceManager && (
              <Card className="rounded-md">
                <CardHeader>
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-base">{sourceForm.id ? 'Edit Source' : 'Add Source'}</CardTitle>
                    {sourceForm.id && <Button size="sm" variant="outline" onClick={resetSourceForm}>New</Button>}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Input placeholder="Source name" value={sourceForm.source_name} onChange={(e) => setSourceForm((v) => ({ ...v, source_name: e.target.value }))} />
                  <select className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={sourceForm.provider_type} onChange={(e) => setSourceForm((v) => ({ ...v, provider_type: e.target.value as ProviderType }))}>
                    <option value="rss">RSS</option>
                    <option value="ics">ICS</option>
                    <option value="api">API</option>
                    <option value="html">HTML Page</option>
                  </select>
                  <Input placeholder="Feed, API, calendar, or page URL" value={sourceForm.source_url} onChange={(e) => setSourceForm((v) => ({ ...v, source_url: e.target.value }))} />
                  {sourceForm.provider_type === 'html' && (
                    <select className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={sourceForm.parser_key} onChange={(e) => setSourceForm((v) => ({ ...v, parser_key: e.target.value }))}>
                      <option value="">Auto parser</option>
                      {PARSER_OPTIONS.map((parser) => <option key={parser} value={parser}>{parser}</option>)}
                    </select>
                  )}
                  <select className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={sourceForm.geography_scope} onChange={(e) => setSourceForm((v) => ({ ...v, geography_scope: e.target.value as EventScope }))}>
                    {SCOPE_OPTIONS.filter((option) => option.value).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                  <Input placeholder="Country" value={sourceForm.country} onChange={(e) => setSourceForm((v) => ({ ...v, country: e.target.value }))} />
                  <Input placeholder="State" value={sourceForm.state} onChange={(e) => setSourceForm((v) => ({ ...v, state: e.target.value }))} />
                  <Input placeholder="District" value={sourceForm.district} onChange={(e) => setSourceForm((v) => ({ ...v, district: e.target.value }))} />
                  <Input placeholder="Categories, comma separated" value={sourceForm.categories_csv} onChange={(e) => setSourceForm((v) => ({ ...v, categories_csv: e.target.value }))} />
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="Trust 0-1" value={sourceForm.trust_score} onChange={(e) => setSourceForm((v) => ({ ...v, trust_score: e.target.value }))} />
                    <Input placeholder="Polling minutes" value={sourceForm.polling_interval_minutes} onChange={(e) => setSourceForm((v) => ({ ...v, polling_interval_minutes: e.target.value }))} />
                  </div>
                  <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                    <input type="checkbox" checked={sourceForm.active} onChange={(e) => setSourceForm((v) => ({ ...v, active: e.target.checked }))} />
                    Active
                  </label>
                  <div className="flex gap-2">
                    <Button className="flex-1" onClick={() => void saveSource()}>{sourceForm.id ? 'Save' : 'Add'}</Button>
                    <Button variant="outline" onClick={resetSourceForm}>Clear</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="rounded-md">
              <CardHeader>
                <CardTitle className="text-base">Sources</CardTitle>
              </CardHeader>
              <CardContent className="max-h-[640px] space-y-2 overflow-y-auto pr-1">
                {sources.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No sources configured yet.</p>
                ) : sources.map((source) => (
                  <div key={source.id} className="rounded-md border p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{source.source_name}</span>
                      <div className="flex shrink-0 gap-1">
                        <Badge variant={source.health_status === 'healthy' ? 'default' : source.health_status === 'error' ? 'destructive' : 'outline'}>{source.health_status ?? 'unknown'}</Badge>
                        <Badge variant={source.active ? 'outline' : 'secondary'}>{source.active ? 'Active' : 'Paused'}</Badge>
                        <Badge variant="secondary">{source.provider_type}</Badge>
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {source.geography_scope} · Last success {formatOptionalDateTime(source.last_success_at ?? source.last_ingested_at)}
                    </p>
                    {source.last_checked_at && <p className="mt-1 text-xs text-muted-foreground">Checked {formatDateTime(source.last_checked_at)}</p>}
                    {source.last_error && <p className="mt-1 text-xs text-destructive">{describeSourceError(source.last_error)}</p>}
                    {source.categories?.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {source.categories.slice(0, 6).map((category) => (
                          <Badge key={category} variant="outline" className="text-[11px]">
                            {category}
                          </Badge>
                        ))}
                      </div>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => editSource(source)}>
                        <Settings2 className="mr-1 h-3 w-3" />
                        Edit
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => void testSource(source)} disabled={loading || ingesting}>
                        <Search className="mr-1 h-3 w-3" />
                        Test
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => void runIngestion([source.id])} disabled={ingesting || !source.active}>
                        <Play className="mr-1 h-3 w-3" />
                        Fetch
                      </Button>
                      {source.active ? (
                        <Button size="sm" variant="outline" onClick={() => void setSourceActive(source, false)}>
                          <Pause className="mr-1 h-3 w-3" />
                          Pause
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => void setSourceActive(source, true)}>
                          <Play className="mr-1 h-3 w-3" />
                          Activate
                        </Button>
                      )}
                      <a className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary" href={source.source_url} target="_blank" rel="noreferrer">
                        Open <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="rounded-md">
              <CardHeader>
                <CardTitle className="text-base">Recent Runs</CardTitle>
              </CardHeader>
              <CardContent className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
                {runs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No scrape runs yet.</p>
                ) : runs.map((run) => (
                  <div key={run.id} className="rounded-md border p-3 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{run.event_sources?.source_name || 'Unknown source'}</span>
                      <Badge variant={run.status === 'success' ? 'default' : run.status === 'partial' ? 'outline' : 'destructive'}>{run.status}</Badge>
                    </div>
                    <div className="mt-1 text-muted-foreground">
                      {run.processed_count} processed | {run.inserted_count} inserted | {run.skipped_count} skipped | {run.error_count} errors
                    </div>
                    <div className="mt-1 text-muted-foreground">{formatDateTime(run.created_at)}</div>
                    {run.metadata?.error_message && <div className="mt-1 text-destructive">{run.metadata.error_message}</div>}
                  </div>
                ))}
              </CardContent>
            </Card>
          </aside>
        </section>
      </div>
    </main>
  );
}
