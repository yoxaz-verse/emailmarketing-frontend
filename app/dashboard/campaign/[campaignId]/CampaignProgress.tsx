'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Activity, Calculator, RefreshCw, Route, TableProperties } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { clientFetch } from '@/lib/client-fetch';
import { cn } from '@/lib/utils';

type RunnerHealth = {
  state?: 'healthy' | 'stale' | 'failed' | 'idle';
  last_heartbeat_at?: string | null;
  heartbeat_age_seconds?: number | null;
  last_successful_send_at?: string | null;
  claimed_count?: number;
  sent_count?: number;
  skipped_count?: number;
  failed_count?: number;
  claim_reason?: string | null;
  fatal_error?: string | null;
};

type Analytics = {
  sent?: number;
  delivered?: number;
  opened?: number;
  replied?: number;
  bounced_total?: number;
  delivery_rate?: number;
  open_rate?: number;
  reply_rate?: number;
  bounce_rate?: number;
  open_rate_visible?: boolean;
  open_rate_visibility_reason?: string;
  spam_hints?: string[];
};

type ProgressSummary = {
  total: number;
  groups: Array<{ status: string; current_step: number; count: number }>;
  lead_mix?: { eligible?: number; risky?: number; suppressed?: number };
  rounds?: RoundSummary[];
};

type SenderBreakdown = {
  inbox_id?: string | null;
  email: string;
  count: number;
};

type RoundSummary = {
  round: number;
  total_count: number;
  sent_count: number;
  queued_count: number;
  failed_count: number;
  state: 'completed' | 'in_progress' | 'waiting' | string;
  sender_breakdown?: SenderBreakdown[];
};

type Inbox = {
  id: string;
  email_address?: string | null;
  daily_limit?: number | null;
  hourly_limit?: number | null;
  warmup_enabled?: boolean | null;
  warmup_day?: number | null;
};

type SendingLimits = {
  schedule_enabled?: boolean;
  schedule_timezone?: string;
  allowed_weekdays?: number[];
  send_window_start?: string;
  send_window_end?: string;
  warmup_steps?: Array<{ day: number; daily_limit: number; hourly_limit: number }>;
} | null;

type SequenceStep = { id?: string; step_number?: number; subject?: string | null; delay_days?: number | null };
type RunnerHealthResponse = { runner_health?: RunnerHealth | null };
type ProgressAvailability = { health: boolean; analytics: boolean; summary: boolean };

function parseMinutes(value: string): number | null {
  const match = value.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function resolveSchedule(config: SendingLimits) {
  const enabled = config?.schedule_enabled ?? true;
  const start = String(config?.send_window_start ?? '00:00');
  const end = String(config?.send_window_end ?? '23:59');
  const startMinutes = parseMinutes(start);
  const endMinutes = parseMinutes(end);
  const windowHours = enabled && startMinutes !== null && endMinutes !== null
    ? Math.max(0, endMinutes - startMinutes) / 60
    : 24;
  const allowedWeekdays = enabled
    ? Array.from(new Set((config?.allowed_weekdays ?? [0, 1, 2, 3, 4, 5, 6]).map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)))
    : [0, 1, 2, 3, 4, 5, 6];
  return {
    windowHours: Math.max(0, windowHours),
    windowLabel: enabled ? `${start}–${end}` : 'All day',
    timezone: String(config?.schedule_timezone ?? 'Asia/Kolkata'),
    allowedWeekdays: allowedWeekdays.length ? allowedWeekdays : [0, 1, 2, 3, 4, 5, 6],
  };
}

function effectiveLimits(inbox: Inbox, config: SendingLimits) {
  const baseDaily = Math.max(0, Number(inbox.daily_limit ?? 0));
  const baseHourly = Math.max(0, Number(inbox.hourly_limit ?? 0));
  if (!inbox.warmup_enabled || !config?.warmup_steps?.length) return { daily: baseDaily, hourly: baseHourly };
  const day = Math.max(1, Number(inbox.warmup_day ?? 1));
  const step = config.warmup_steps.find((row) => Number(row.day) === day);
  return step
    ? { daily: Math.max(0, Number(step.daily_limit ?? baseDaily)), hourly: Math.max(0, Number(step.hourly_limit ?? baseHourly)) }
    : { daily: baseDaily, hourly: baseHourly };
}

function addAllowedDays(anchor: Date, days: number, allowedWeekdays: number[]) {
  const date = new Date(anchor);
  let remaining = Math.max(0, Math.ceil(days));
  while (remaining > 0) {
    if (allowedWeekdays.includes(date.getDay())) remaining -= 1;
    if (remaining > 0) date.setDate(date.getDate() + 1);
  }
  return date;
}

function formatDate(date: Date) {
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function metricValue(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number.toLocaleString() : '0';
}

function rateValue(value: unknown) {
  const number = Number(value ?? 0);
  return `${Number.isFinite(number) ? number.toFixed(1).replace(/\.0$/, '') : '0'}%`;
}

function statusLabel(value: unknown) {
  return String(value ?? 'pending').replaceAll('_', ' ') || 'pending';
}

function statusClass(value: unknown) {
  const normalized = String(value ?? '').toLowerCase();
  if (normalized === 'sent' || normalized === 'completed') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
  if (['failed', 'error', 'bounced', 'blocked', 'skipped', 'suppressed'].includes(normalized)) return 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300';
  if (['queued', 'pending', 'in_progress', 'processing'].includes(normalized)) return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300';
  return 'border-border bg-muted text-muted-foreground';
}

const progressSectionClass = 'rounded-xl border border-border bg-card/50 p-5 dark:border-white/[0.14] dark:bg-white/[0.055] dark:shadow-[0_12px_36px_rgb(0,0,0,0.28)]';
const progressInnerCardClass = 'rounded-lg border border-border p-3 dark:border-white/[0.12] dark:bg-black/20';
const progressTableFrameClass = 'mt-4 overflow-x-auto rounded-lg border border-border dark:border-white/[0.12] dark:bg-black/20';

function RoundProgressCards({ rounds, sequenceName }: { rounds: RoundSummary[]; sequenceName?: string | null }) {
  return (
    <section className={progressSectionClass}>
      <div className="flex items-center gap-2"><Route className="size-4 text-primary" /><h2 className="font-semibold">Round progress</h2></div>
      <p className="mt-1 text-xs text-muted-foreground">{sequenceName || 'No sequence assigned'} · successful sends and sender inbox usage by round.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {rounds.length ? rounds.map((round) => {
          const total = Math.max(0, Number(round.total_count ?? 0));
          const sent = Math.max(0, Number(round.sent_count ?? 0));
          const progress = total > 0 ? Math.min(100, Math.round((sent / total) * 100)) : 0;
          const state = round.state === 'completed' ? 'Completed' : round.state === 'in_progress' ? 'In progress' : 'Waiting';
          return (
            <div key={round.round} className="rounded-lg border border-border p-4 dark:border-white/[0.12] dark:bg-black/20">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs text-muted-foreground">Round {round.round}</div>
                  <div className="mt-1 text-lg font-semibold">{state}</div>
                </div>
                <span className={cn('rounded-full border px-2 py-1 text-[10px] font-medium', statusClass(round.state))}>{progress}%</span>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div><span className="text-muted-foreground">Sent</span><div className="font-semibold">{sent.toLocaleString()} / {total.toLocaleString()}</div></div>
                <div><span className="text-muted-foreground">Queued</span><div className="font-semibold">{metricValue(round.queued_count)}</div></div>
                <div><span className="text-muted-foreground">Failed</span><div className="font-semibold">{metricValue(round.failed_count)}</div></div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                {round.sender_breakdown?.length ? round.sender_breakdown.slice(0, 4).map((sender) => (
                  <span key={`${round.round}:${sender.inbox_id || sender.email}`} className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground dark:bg-white/[0.055]">
                    {sender.email}: {sender.count}
                  </span>
                )) : <span className="text-xs text-muted-foreground">No successful sender logs yet</span>}
              </div>
            </div>
          );
        }) : <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground dark:border-white/[0.14] dark:bg-black/20">Attach leads and start sending to see round progress.</div>}
      </div>
    </section>
  );
}

function ExecutionTable({ campaignId }: { campaignId: string }) {
  type Row = {
    id: string;
    lead_email?: string | null;
    round?: number | null;
    process_status?: string | null;
    sender_email?: string | null;
    sent_at?: string | null;
    reason?: string | null;
  };
  type Response = { rows: Row[]; total: number; page: number; page_size: number };
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Response>({ rows: [], total: 0, page: 1, page_size: 50 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async ({ showLoading = false }: { showLoading?: boolean } = {}) => {
    if (showLoading) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    setError(null);
    try {
      setData(await clientFetch<Response>(`/campaigns/${campaignId}/progress/logs?page=${page}&page_size=50`));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Execution logs are unavailable.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [campaignId, page]);

  useEffect(() => { void load({ showLoading: true }); }, [load]);

  useEffect(() => {
    const refreshIfVisible = () => {
      if (document.hidden) return;
      void load().catch(() => undefined);
    };

    const interval = window.setInterval(refreshIfVisible, 5_000);
    document.addEventListener('visibilitychange', refreshIfVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', refreshIfVisible);
    };
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(data.total / data.page_size));

  useEffect(() => {
    setPage((value) => Math.min(value, totalPages));
  }, [totalPages]);

  return (
    <section className={progressSectionClass}>
      <div className="flex items-center justify-between gap-3">
        <div><div className="flex items-center gap-2"><TableProperties className="size-4 text-primary" /><h2 className="font-semibold">Execution logs</h2></div><p className="mt-1 text-xs text-muted-foreground">Successful sends and queued work by lead, round, sender inbox, and process status.</p></div>
        <Button size="sm" variant="outline" onClick={() => void load({ showLoading: true })} disabled={loading || refreshing}><RefreshCw />Refresh</Button>
      </div>
      {error ? <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-700 dark:text-amber-300">{error}</div> : (
        <div className={progressTableFrameClass}>
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-muted/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground dark:bg-white/[0.045]"><tr><th className="p-3">Lead</th><th>Round</th><th>Status</th><th>Sender email used</th><th>Sent at</th><th>Reason/details</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Loading execution logs…</td></tr> : data.rows.length === 0 ? <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No execution logs yet.</td></tr> : data.rows.map((row) => (
                <tr key={row.id} className="border-t border-border/70 dark:border-white/10">
                  <td className="p-3 font-medium">{row.lead_email || 'Unknown lead'}</td>
                  <td>Round {Math.max(1, Number(row.round ?? 1))}</td>
                  <td><span className={cn('inline-flex rounded-full border px-2 py-1 text-[11px] font-medium capitalize', statusClass(row.process_status))}>{statusLabel(row.process_status)}</span></td>
                  <td>{row.sender_email || 'Unassigned'}</td>
                  <td>{row.sent_at ? new Date(row.sent_at).toLocaleString() : '—'}</td>
                  <td className="max-w-72 truncate text-muted-foreground" title={row.reason || ''}>{row.reason || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground"><span>{data.total.toLocaleString()} log rows · Page {data.page} of {totalPages}</span><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1 || loading}>Previous</Button><Button size="sm" variant="outline" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={page >= totalPages || loading}>Next</Button></div></div>
    </section>
  );
}

export default function CampaignProgress({
  campaignId,
  campaign,
  sequence,
  sequenceSteps,
  inboxes,
  campaignInboxes,
  sendingLimits,
  runner,
  analytics,
  summary,
  availability,
  projectionAnchorIso,
}: {
  campaignId: string;
  campaign: { status?: string | null; started_at?: string | null };
  sequence: { name?: string | null } | null;
  sequenceSteps: SequenceStep[];
  inboxes: Inbox[];
  campaignInboxes: Array<{ inbox_id: string }>;
  sendingLimits: SendingLimits;
  runner: RunnerHealth | null;
  analytics: Analytics | null;
  summary: ProgressSummary;
  availability: ProgressAvailability;
  projectionAnchorIso: string;
}) {
  const [liveRunner, setLiveRunner] = useState<RunnerHealth | null>(runner);
  const [liveAnalytics, setLiveAnalytics] = useState<Analytics | null>(analytics);
  const [liveSummary, setLiveSummary] = useState<ProgressSummary>(summary);
  const [liveAvailability, setLiveAvailability] = useState<ProgressAvailability>(availability);

  useEffect(() => {
    setLiveRunner(runner);
    setLiveAnalytics(analytics);
    setLiveSummary(summary);
    setLiveAvailability(availability);
  }, [runner, analytics, summary, availability]);

  const loadProgressSnapshot = useCallback(async () => {
    const [healthResult, analyticsResult, summaryResult] = await Promise.allSettled([
      clientFetch<RunnerHealthResponse>(`/campaigns/${campaignId}/health-summary`),
      clientFetch<Analytics>(`/campaigns/${campaignId}/reply-open-analytics`, { timeoutMs: 20_000 }),
      clientFetch<ProgressSummary>(`/campaigns/${campaignId}/progress-summary`),
    ]);

    setLiveAvailability({
      health: healthResult.status === 'fulfilled',
      analytics: analyticsResult.status === 'fulfilled',
      summary: summaryResult.status === 'fulfilled',
    });
    if (healthResult.status === 'fulfilled') setLiveRunner(healthResult.value.runner_health ?? null);
    if (analyticsResult.status === 'fulfilled') setLiveAnalytics(analyticsResult.value);
    if (summaryResult.status === 'fulfilled') setLiveSummary(summaryResult.value);
  }, [campaignId]);

  useEffect(() => {
    const refreshIfVisible = () => {
      if (document.hidden) return;
      void loadProgressSnapshot().catch(() => undefined);
    };

    const interval = window.setInterval(refreshIfVisible, 5_000);
    document.addEventListener('visibilitychange', refreshIfVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', refreshIfVisible);
    };
  }, [loadProgressSnapshot]);

  const selectedIds = useMemo(() => new Set(campaignInboxes.map((row) => String(row.inbox_id))), [campaignInboxes]);
  const selectedInboxes = useMemo(() => inboxes.filter((inbox) => selectedIds.has(String(inbox.id))), [inboxes, selectedIds]);
  const schedule = useMemo(() => resolveSchedule(sendingLimits), [sendingLimits]);
  const sortedSteps = useMemo(() => [...sequenceSteps].sort((a, b) => Number(a.step_number ?? 0) - Number(b.step_number ?? 0)), [sequenceSteps]);
  const attachableLeads = Number(liveSummary.lead_mix?.eligible ?? 0) + Number(liveSummary.lead_mix?.risky ?? 0);
  const totalDelayDays = sortedSteps.reduce((sum, step) => sum + Math.max(0, Number(step.delay_days ?? 0)), 0);
  const totalProjectedSends = attachableLeads * sortedSteps.length;
  const capacityRows = selectedInboxes.map((inbox) => {
    const limits = effectiveLimits(inbox, sendingLimits);
    const contribution = Math.max(0, Math.min(limits.daily, limits.hourly * schedule.windowHours));
    return { id: inbox.id, email: inbox.email_address || inbox.id, daily: limits.daily, hourly: limits.hourly, contribution };
  });
  const dailyCapacity = capacityRows.reduce((sum, row) => sum + row.contribution, 0);
  const hourlyCapacity = capacityRows.reduce((sum, row) => sum + row.hourly, 0);
  const processingDays = dailyCapacity > 0 ? Math.ceil(totalProjectedSends / dailyCapacity) : 0;
  const estimatedHours = dailyCapacity > 0 ? (totalProjectedSends / dailyCapacity) * schedule.windowHours : 0;
  const totalDurationDays = processingDays + totalDelayDays;
  const anchor = new Date(projectionAnchorIso);
  const estimatedEnd = addAllowedDays(anchor, processingDays, schedule.allowedWeekdays);
  estimatedEnd.setDate(estimatedEnd.getDate() + totalDelayDays);
  const cumulativeStepDays = sortedSteps.reduce<number[]>((values, step, index) => {
    values.push((values[index - 1] ?? 0) + Math.max(0, Number(step.delay_days ?? 0)));
    return values;
  }, []);
  const missing: string[] = [];
  if (!liveAvailability.summary) missing.push('restore aggregate lead progress data');
  if (!selectedInboxes.length) missing.push('select at least one sending inbox');
  if (liveAvailability.summary && !attachableLeads) missing.push('attach an eligible or risky lead');
  if (!sortedSteps.length) missing.push('configure sequence steps');
  if (selectedInboxes.length && dailyCapacity <= 0) missing.push('configure positive inbox sending limits');
  const isLaunched = Boolean(campaign.started_at || !['draft', ''].includes(String(campaign.status ?? '').toLowerCase()));
  const runnerState = liveRunner?.state ?? 'idle';
  const roundSummaries = liveSummary.rounds ?? [];

  const kpis = [
    ['Attached', liveAvailability.summary ? liveSummary.total : '—'],
    ['Sent', liveAvailability.analytics ? liveAnalytics?.sent : '—'],
    ['Delivered', liveAvailability.analytics ? liveAnalytics?.delivered : '—'],
    ['Opened', liveAvailability.analytics ? (liveAnalytics?.open_rate_visible === false ? 'Unconfirmed' : liveAnalytics?.opened) : '—'],
    ['Replied', liveAvailability.analytics ? liveAnalytics?.replied : '—'],
    ['Bounced', liveAvailability.analytics ? liveAnalytics?.bounced_total : '—'],
  ];

  return (
    <div className="space-y-6">
      <section className={progressSectionClass}>
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div><div className="flex items-center gap-2"><Activity className="size-4 text-primary" /><span className="text-xs uppercase tracking-wider text-muted-foreground">Campaign runner</span></div><div className={cn('mt-2 text-xl font-semibold capitalize', runnerState === 'healthy' && 'text-emerald-600 dark:text-emerald-300', ['failed', 'stale'].includes(runnerState) && 'text-rose-600 dark:text-rose-300')}>{liveAvailability.health ? runnerState : 'Unavailable'}</div><p className="mt-1 text-xs text-muted-foreground">{liveRunner?.last_heartbeat_at ? `Last heartbeat ${new Date(liveRunner.last_heartbeat_at).toLocaleString()}` : 'No runner heartbeat recorded.'}</p>{liveRunner?.fatal_error || liveRunner?.claim_reason ? <p className="mt-2 text-xs text-rose-600 dark:text-rose-300">{liveRunner.fatal_error || liveRunner.claim_reason}</p> : null}</div>
          <div className="grid grid-cols-4 gap-4 text-center text-xs"><div><span className="text-muted-foreground">Claimed</span><div className="font-semibold">{liveAvailability.health ? metricValue(liveRunner?.claimed_count) : '—'}</div></div><div><span className="text-muted-foreground">Sent</span><div className="font-semibold">{liveAvailability.health ? metricValue(liveRunner?.sent_count) : '—'}</div></div><div><span className="text-muted-foreground">Skipped</span><div className="font-semibold">{liveAvailability.health ? metricValue(liveRunner?.skipped_count) : '—'}</div></div><div><span className="text-muted-foreground">Failed</span><div className="font-semibold">{liveAvailability.health ? metricValue(liveRunner?.failed_count) : '—'}</div></div></div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">{kpis.map(([label, value]) => <div key={String(label)} className={progressInnerCardClass}><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 text-xl font-semibold">{typeof value === 'string' ? value : metricValue(value)}</div></div>)}</div>
        <div className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4"><div className={progressInnerCardClass}>Delivery rate <strong className="float-right">{liveAvailability.analytics ? rateValue(liveAnalytics?.delivery_rate) : '—'}</strong></div><div className={progressInnerCardClass}>Open rate <strong className="float-right">{liveAvailability.analytics ? (liveAnalytics?.open_rate_visible === false ? 'Unconfirmed' : rateValue(liveAnalytics?.open_rate)) : '—'}</strong></div><div className={progressInnerCardClass}>Reply rate <strong className="float-right">{liveAvailability.analytics ? rateValue(liveAnalytics?.reply_rate) : '—'}</strong></div><div className={progressInnerCardClass}>Bounce rate <strong className="float-right">{liveAvailability.analytics ? rateValue(liveAnalytics?.bounce_rate) : '—'}</strong></div></div>
        {!liveAvailability.analytics ? <p className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-xs text-amber-700 dark:text-amber-300">Delivery analytics are temporarily unavailable; projection and execution progress remain visible.</p> : null}
        {liveAnalytics?.open_rate_visible === false && liveAnalytics.open_rate_visibility_reason ? <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">{liveAnalytics.open_rate_visibility_reason}</p> : null}
        {liveAnalytics?.spam_hints?.length ? <p className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-xs text-amber-700 dark:text-amber-300">{liveAnalytics.spam_hints.join(' ')}</p> : null}
        <Link href={`/dashboard/campaign/replies?campaign_id=${campaignId}`} className="mt-4 inline-flex text-sm font-medium text-primary hover:underline">View replies</Link>
      </section>

      <section className={cn(progressSectionClass, 'overflow-hidden')}>
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><div className="flex items-center gap-2"><Calculator className="size-4 text-primary" /><h2 className="font-semibold">Campaign projection</h2></div><p className="mt-1 text-xs text-muted-foreground">{isLaunched ? 'Baseline estimate from the current campaign setup.' : 'Pre-launch estimate from inbox capacity, schedule, leads, and sequence delays.'}</p></div><div className="text-left sm:text-right"><div className="text-xs uppercase tracking-wider text-muted-foreground">Estimated completion</div><div className="mt-1 text-2xl font-semibold">{missing.length ? 'Cannot project yet' : `${totalDurationDays} days`}</div>{!missing.length ? <div className="text-xs text-muted-foreground">{formatDate(estimatedEnd)}</div> : null}</div></div>
        {missing.length ? <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-700 dark:text-amber-300">To calculate a reliable projection: {missing.join(', ')}.</div> : null}
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">{[
          ['Selected inboxes', selectedInboxes.length], ['Attachable leads', attachableLeads], ['Hourly capacity', `${Math.floor(hourlyCapacity)}/h`], ['Daily throughput', `${Math.floor(dailyCapacity)}/day`], ['Send window', schedule.windowLabel], ['Total sends', totalProjectedSends],
        ].map(([label, value]) => <div key={String(label)} className={progressInnerCardClass}><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 font-semibold">{value}</div>{label === 'Send window' ? <div className="mt-1 text-[10px] text-muted-foreground">{schedule.timezone}</div> : null}</div>)}</div>
        <div className="mt-3 grid gap-3 text-xs sm:grid-cols-3"><div className={progressInnerCardClass}>Estimated sending hours <strong className="float-right">{missing.length ? '—' : `${estimatedHours.toFixed(1)}h`}</strong></div><div className={progressInnerCardClass}>Processing days <strong className="float-right">{missing.length ? '—' : `${processingDays}d`}</strong></div><div className={progressInnerCardClass}>Sequence delay <strong className="float-right">{totalDelayDays}d</strong></div></div>

        <div className={cn(progressTableFrameClass, 'mt-5')}><table className="w-full min-w-[650px] text-sm"><thead className="bg-muted/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground dark:bg-white/[0.045]"><tr><th className="p-3">Inbox</th><th>Effective limits</th><th>Window-adjusted</th><th>Final contribution</th></tr></thead><tbody>{capacityRows.length ? capacityRows.map((row) => <tr key={row.id} className="border-t border-border/70 dark:border-white/10"><td className="p-3 font-medium">{row.email}</td><td>{Math.floor(row.daily)}/day · {Math.floor(row.hourly)}/h</td><td>{Math.floor(row.hourly * schedule.windowHours)}/day</td><td>{Math.floor(row.contribution)}/day</td></tr>) : <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">No sending inboxes selected.</td></tr>}</tbody></table></div>

        {!missing.length ? <div className="mt-5 overflow-x-auto rounded-lg border border-border p-4 dark:border-white/[0.12] dark:bg-black/20"><div className="mb-8 text-xs uppercase tracking-wider text-muted-foreground">Projected sequence timeline</div><div className="relative h-24 min-w-[680px]"><div className="absolute left-0 right-0 top-8 h-2 rounded-full bg-gradient-to-r from-primary via-amber-400 to-emerald-400" />{sortedSteps.map((step, index) => { const day = cumulativeStepDays[index] ?? 0; const left = totalDurationDays > 0 ? Math.min(100, (day / totalDurationDays) * 100) : 0; return <div key={step.id || index} className="absolute top-8" style={{ left: `${left}%`, transform: 'translate(-50%, -50%)' }}><div className="size-4 rounded-full border-2 border-background bg-primary ring-2 ring-primary/20 dark:border-black dark:ring-primary/35" /><div className={cn('absolute left-1/2 w-36 -translate-x-1/2 text-center text-[10px]', index % 2 ? 'top-6' : '-top-8')}>Step {step.step_number ?? index + 1} · Day {day}</div></div>; })}<div className="absolute bottom-0 left-0 text-[10px] text-muted-foreground">Start · {formatDate(anchor)}</div><div className="absolute bottom-0 right-0 text-right text-[10px] text-muted-foreground">End · {formatDate(estimatedEnd)}</div></div></div> : null}
        {sortedSteps.length ? <div className={cn(progressTableFrameClass, 'mt-5')}><table className="w-full min-w-[600px] text-sm"><thead className="bg-muted/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground dark:bg-white/[0.045]"><tr><th className="p-3">Step</th><th>Subject</th><th>Delay</th><th>Projected day</th></tr></thead><tbody>{sortedSteps.map((step, index) => <tr key={step.id || index} className="border-t border-border/70 dark:border-white/10"><td className="p-3">Step {step.step_number ?? index + 1}</td><td>{step.subject || 'Untitled step'}</td><td>+{Math.max(0, Number(step.delay_days ?? 0))}d</td><td>Day {cumulativeStepDays[index] ?? 0}</td></tr>)}</tbody></table></div> : null}
      </section>

      {!liveAvailability.summary ? (
        <section className={progressSectionClass}>
          <div className="flex items-center gap-2"><Route className="size-4 text-primary" /><h2 className="font-semibold">Round progress</h2></div>
          <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-700 dark:text-amber-300">Round progress is temporarily unavailable.</div>
        </section>
      ) : (
        <RoundProgressCards rounds={roundSummaries} sequenceName={sequence?.name} />
      )}

      <ExecutionTable campaignId={campaignId} />
    </div>
  );
}
