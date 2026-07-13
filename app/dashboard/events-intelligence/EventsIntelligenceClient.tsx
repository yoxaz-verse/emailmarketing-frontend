'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Check, ExternalLink, Filter, RefreshCw, Search, X } from 'lucide-react';
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
  active: boolean;
  last_ingested_at: string | null;
  last_error: string | null;
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

function parseCsv(input: string): string[] {
  return Array.from(new Set(input.split(',').map((item) => item.trim()).filter(Boolean)));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
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
    source_name: '',
    provider_type: 'rss' as ProviderType,
    source_url: '',
    geography_scope: 'international' as EventScope,
    country: '',
    state: '',
    district: '',
    categories_csv: '',
  });

  const [planningNotes, setPlanningNotes] = useState('');

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) ?? events[0] ?? null,
    [events, selectedEventId]
  );

  const plannedCount = useMemo(() => events.filter((event) => event.status === 'planned').length, [events]);
  const nextSevenCount = useMemo(() => {
    const now = Date.now();
    const limit = now + 7 * 86_400_000;
    return events.filter((event) => {
      const starts = new Date(event.starts_at).getTime();
      return starts >= now && starts <= limit && event.status !== 'ignored';
    }).length;
  }, [events]);

  const refreshAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const query = buildQuery(filters);
      const [eventData, sourceData] = await Promise.all([
        clientFetch<EventListResponse>(`/events?${query}`),
        clientFetch<EventSource[]>('/events/sources'),
      ]);
      setEvents(eventData.rows || []);
      setSources(sourceData || []);
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
    await refreshAll();
  };

  const createSource = async () => {
    try {
      setError(null);
      await clientFetch('/events/sources', {
        method: 'POST',
        body: JSON.stringify({
          source_name: sourceForm.source_name.trim(),
          provider_type: sourceForm.provider_type,
          source_url: sourceForm.source_url.trim(),
          geography_scope: sourceForm.geography_scope,
          country: sourceForm.country.trim() || null,
          state: sourceForm.state.trim() || null,
          district: sourceForm.district.trim() || null,
          categories: parseCsv(sourceForm.categories_csv),
          parser_key: sourceForm.provider_type === 'html' ? 'generic_html_events' : null,
          trust_score: 0.7,
          polling_interval_minutes: 360,
          active: true,
        }),
      });
      setSourceForm({
        source_name: '',
        provider_type: 'rss',
        source_url: '',
        geography_scope: 'international',
        country: '',
        state: '',
        district: '',
        categories_csv: '',
      });
      await refreshAll();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create source');
    }
  };

  const runIngestion = async () => {
    try {
      setIngesting(true);
      setError(null);
      const summary = await clientFetch<IngestionSummary>('/events/ingest/run', { method: 'POST' });
      setLastIngestion(summary);
      await refreshAll();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to refresh event sources');
    } finally {
      setIngesting(false);
    }
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
            <Button onClick={() => void runIngestion()} disabled={ingesting}>
              <RefreshCw className={cn('mr-2 h-4 w-4', ingesting && 'animate-spin')} />
              Refresh Sources
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
          <div className="mb-3 flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Filters</h2>
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

            <Card className="rounded-md">
              <CardHeader>
                <CardTitle className="text-base">Add Source</CardTitle>
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
                <select className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={sourceForm.geography_scope} onChange={(e) => setSourceForm((v) => ({ ...v, geography_scope: e.target.value as EventScope }))}>
                  {SCOPE_OPTIONS.filter((option) => option.value).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                <Input placeholder="Country" value={sourceForm.country} onChange={(e) => setSourceForm((v) => ({ ...v, country: e.target.value }))} />
                <Input placeholder="State" value={sourceForm.state} onChange={(e) => setSourceForm((v) => ({ ...v, state: e.target.value }))} />
                <Input placeholder="District" value={sourceForm.district} onChange={(e) => setSourceForm((v) => ({ ...v, district: e.target.value }))} />
                <Input placeholder="Categories, comma separated" value={sourceForm.categories_csv} onChange={(e) => setSourceForm((v) => ({ ...v, categories_csv: e.target.value }))} />
                <Button className="w-full" onClick={() => void createSource()}>Add Source</Button>
              </CardContent>
            </Card>

            <Card className="rounded-md">
              <CardHeader>
                <CardTitle className="text-base">Sources</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {sources.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No sources configured yet.</p>
                ) : sources.slice(0, 8).map((source) => (
                  <div key={source.id} className="rounded-md border p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{source.source_name}</span>
                      <Badge variant={source.active ? 'outline' : 'secondary'}>{source.provider_type}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{source.geography_scope}{source.last_error ? ` - ${source.last_error}` : ''}</p>
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
