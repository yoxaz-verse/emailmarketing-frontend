"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from '@/components/ui/card';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Mail,
  Users,
  TrendingUp,
  Clock,
  AlertTriangle,
  CheckCircle2,
  RefreshCcw
} from 'lucide-react';

type OperationsSummaryData = {
  campaigns: {
    total: number;
    running: number;
    paused: number;
    draft: number;
  };
  inboxes: {
    total: number;
    active: number;
    in_use: number;
    idle: number;
    paused: number;
    hard_paused: number;
  };
  capacity: {
    total_daily_capacity: number;
    in_use_daily_capacity: number;
    idle_daily_capacity: number;
  };
  leads: {
    total: number;
    free_send_ready: number;
    used: number;
    blocked_or_failed: number;
  };
  replies: {
    total_replied: number;
    replied_last_7d: number;
    unreviewed_replies: number;
    interested_replies: number;
  };
  health: {
    inboxes_needing_attention: number;
  };
};

export default function OverviewPage() {
  const REQUEST_TIMEOUT_MS = 12000;
  const RETRY_DELAY_MS = 800;
  const [data, setData] = useState<OperationsSummaryData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [connectionState, setConnectionState] = useState<'connected' | 'backend_unavailable' | 'route_missing' | 'error' | 'loading'>('loading');

  const loadSummary = useCallback(async () => {
    setIsRefreshing(true);
    setLoadError(null);
    setConnectionState((previous) => (previous === 'connected' ? previous : 'loading'));
    const fetchSummary = async () => {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const res = await fetch('/api/proxy/stats/operations-summary', {
          method: 'GET',
          cache: 'no-store',
          signal: controller.signal,
        });
        const body = await res.json().catch(() => null);

        if (!res.ok) {
          const typedBody = (body as { status?: string; error?: string; detail?: string } | null) ?? null;
          const explicitStatus = String(typedBody?.status ?? '');
          const errorText = `${typedBody?.error ?? ''} ${typedBody?.detail ?? ''}`.toLowerCase();

          if (
            explicitStatus === 'backend_unavailable' ||
            res.status === 503 ||
            errorText.includes('backend unavailable')
          ) {
            setConnectionState('backend_unavailable');
          } else if (
            explicitStatus === 'route_missing' ||
            (res.status === 404 && errorText.includes('operations summary route missing'))
          ) {
            setConnectionState('route_missing');
          } else {
            setConnectionState('error');
          }
          const message = String((body as { error?: string } | null)?.error ?? `Failed to load stats (${res.status})`);
          throw new Error(message);
        }

        setData(body as OperationsSummaryData);
        setConnectionState('connected');
      } catch (err) {
        const isAbort = err instanceof DOMException && err.name === 'AbortError';
        if (isAbort) {
          setConnectionState('error');
          throw new Error('Request timed out. Click Refresh to retry.');
        }
        throw err;
      } finally {
        window.clearTimeout(timeoutId);
      }
    };

    try {
      await fetchSummary();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load stats';
      const shouldRetry =
        message.toLowerCase().includes('timed out') ||
        message.toLowerCase().includes('network') ||
        message.toLowerCase().includes('fetch failed') ||
        message.toLowerCase().includes('backend unavailable');

      if (shouldRetry) {
        await new Promise((resolve) => window.setTimeout(resolve, RETRY_DELAY_MS));
        try {
          await fetchSummary();
          return;
        } catch (retryErr) {
          const retryMessage = retryErr instanceof Error ? retryErr.message : 'Failed to load stats';
          setConnectionState((previous) => (previous === 'loading' ? 'error' : previous));
          setLoadError(retryMessage);
        }
      } else {
        setConnectionState((previous) => (previous === 'loading' ? 'error' : previous));
        setLoadError(message);
      }
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);
  const operations = useMemo(() => data, [data]);
  const statusLabel = useMemo(() => {
    if (connectionState === 'connected') return 'Connected';
    if (connectionState === 'backend_unavailable') return 'Backend unavailable';
    if (connectionState === 'route_missing') return 'Route missing';
    if (connectionState === 'loading') return 'Loading';
    return 'Error';
  }, [connectionState]);

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h2>
          <p className="text-muted-foreground">Welcome back. Here&apos;s what&apos;s happening today.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => void loadSummary()} disabled={isRefreshing}>
            <RefreshCcw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Link href="/dashboard/leads">
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Users className="mr-2 h-4 w-4" /> Import Leads
            </Button>
          </Link>
          <Link href="/dashboard/campaign">
            <Button variant="outline">
              <TrendingUp className="mr-2 h-4 w-4" /> New Campaign
            </Button>
          </Link>
        </div>
      </div>
      <div className="text-xs text-muted-foreground">
        API status: <span className="font-medium text-foreground">{statusLabel}</span>
      </div>

      {/* Main Metrics Grid */}
      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="border border-border shadow-sm bg-card overflow-hidden">
          <div className="h-1 bg-yellow-500" />
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2 uppercase tracking-wider">
              <Clock className="h-4 w-4 text-yellow-500" /> Running Campaigns
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{operations ? operations.campaigns.running : '—'}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {operations ? `${operations.campaigns.paused} paused • ${operations.campaigns.draft} drafts` : 'Loading campaign status…'}
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border shadow-sm bg-card overflow-hidden">
          <div className="h-1 bg-blue-500" />
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2 uppercase tracking-wider">
              <Mail className="h-4 w-4 text-blue-500" /> Active Inboxes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">
              {operations ? operations.inboxes.active : '—'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {operations ? `${operations.inboxes.in_use} in use, ${operations.inboxes.idle} idle` : 'Loading inbox stats…'}
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border shadow-sm bg-card overflow-hidden">
          <div className="h-1 bg-indigo-500" />
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2 uppercase tracking-wider">
              <Mail className="h-4 w-4 text-indigo-500" /> In-Use Inboxes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">
              {operations ? operations.inboxes.in_use : '—'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {operations ? `${operations.inboxes.idle} idle inboxes available` : 'Loading inbox utilization…'}
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border shadow-sm bg-card overflow-hidden">
          <div className="h-1 bg-cyan-500" />
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2 uppercase tracking-wider">
              <Mail className="h-4 w-4 text-cyan-500" /> Idle Inboxes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">
              {operations ? operations.inboxes.idle : '—'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {operations ? `${operations.capacity.idle_daily_capacity.toLocaleString()} idle daily capacity` : 'Loading idle capacity…'}
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border shadow-sm bg-card overflow-hidden">
          <div className="h-1 bg-green-500" />
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2 uppercase tracking-wider">
              <TrendingUp className="h-4 w-4 text-green-500" /> Daily Capacity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {operations ? operations.capacity.total_daily_capacity.toLocaleString() : '—'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {operations ? `${operations.capacity.in_use_daily_capacity.toLocaleString()} in use • ${operations.capacity.idle_daily_capacity.toLocaleString()} idle` : 'Calculating capacity…'}
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border shadow-sm bg-card overflow-hidden">
          <div className="h-1 bg-pink-500" />
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2 uppercase tracking-wider">
              <CheckCircle2 className="h-4 w-4 text-pink-500" /> Replies
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{operations ? operations.replies.total_replied : '—'}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {operations ? `${operations.replies.replied_last_7d} in last 7 days` : 'Loading reply trend…'}
            </p>
          </CardContent>
        </Card>
      </div>

      {loadError && (
        <div className="rounded-lg border border-border bg-card p-3 text-xs text-muted-foreground">
          Overview stats failed to load: {loadError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border border-border shadow-sm bg-card">
          <CardHeader>
            <div>
              <CardTitle>Cold Email Focus</CardTitle>
              <CardDescription>Priority checklist for reliable outbound delivery.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                operations ? `${operations.inboxes.idle} idle inboxes available to allocate.` : 'Loading inbox allocation guidance…',
                operations ? `${operations.replies.unreviewed_replies} unreviewed replies need follow-up.` : 'Loading reply follow-up queue…',
                operations ? `${operations.leads.free_send_ready} free send-ready leads available.` : 'Loading lead availability…',
                operations ? `${operations.capacity.idle_daily_capacity.toLocaleString()} idle daily capacity can be activated.` : 'Loading capacity headroom…',
                operations ? `${operations.campaigns.running} campaigns running right now.` : 'Loading running campaigns…'
              ].map((item) => (
                <div key={item} className="rounded-lg border border-border bg-muted/20 p-3">
                  <p className="text-sm text-foreground">{item}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border border-border shadow-sm bg-card">
            <CardHeader>
              <CardTitle>Operations Summary</CardTitle>
              <CardDescription>Campaigns, inboxes, capacity, leads, and replies.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <span className="text-sm text-muted-foreground">Campaigns (running / paused / draft)</span>
                <span className="text-sm font-semibold text-foreground">
                  {operations ? `${operations.campaigns.running} / ${operations.campaigns.paused} / ${operations.campaigns.draft}` : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <span className="text-sm text-muted-foreground">Active inboxes</span>
                <span className="text-sm font-semibold text-foreground">{operations ? operations.inboxes.active : '—'}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <span className="text-sm text-muted-foreground">Inboxes (paused / hard paused)</span>
                <span className="text-sm font-semibold text-foreground">
                  {operations ? `${operations.inboxes.paused} / ${operations.inboxes.hard_paused}` : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <span className="text-sm text-muted-foreground">In-use / Idle inboxes</span>
                <span className="text-sm font-semibold text-foreground">
                  {operations ? `${operations.inboxes.in_use} / ${operations.inboxes.idle}` : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <span className="text-sm text-muted-foreground">Daily capacity (total)</span>
                <span className="text-sm font-semibold text-foreground">{operations ? operations.capacity.total_daily_capacity.toLocaleString() : '—'}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <span className="text-sm text-muted-foreground">Capacity (in-use / idle)</span>
                <span className="text-sm font-semibold text-foreground">
                  {operations ? `${operations.capacity.in_use_daily_capacity.toLocaleString()} / ${operations.capacity.idle_daily_capacity.toLocaleString()}` : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <span className="text-sm text-muted-foreground">Leads (total / free)</span>
                <span className="text-sm font-semibold text-foreground">
                  {operations ? `${operations.leads.total} / ${operations.leads.free_send_ready}` : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <span className="text-sm text-muted-foreground">Leads (used / blocked)</span>
                <span className="text-sm font-semibold text-foreground">
                  {operations ? `${operations.leads.used} / ${operations.leads.blocked_or_failed}` : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <span className="text-sm text-muted-foreground">Replies (lifetime / 7d)</span>
                <span className="text-sm font-semibold text-foreground">
                  {operations ? `${operations.replies.total_replied} / ${operations.replies.replied_last_7d}` : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <span className="text-sm text-muted-foreground">Replies (interested / unreviewed)</span>
                <span className="text-sm font-semibold text-foreground">
                  {operations ? `${operations.replies.interested_replies} / ${operations.replies.unreviewed_replies}` : '—'}
                </span>
              </div>
              <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-300" />
                  <p className="text-sm font-medium text-foreground">Delivery Watch</p>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {operations
                    ? `${operations.health.inboxes_needing_attention} inboxes need attention, ${operations.replies.unreviewed_replies} replies are unreviewed.`
                    : 'Keep an eye on inboxes nearing daily limits.'}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
