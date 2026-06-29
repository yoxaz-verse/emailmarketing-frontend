import { Suspense } from 'react';
import Link from 'next/link';
import { serverFetch } from '@/lib/server/server-fetch';
import { getCampaignWorkspace } from '@/lib/server/campaign-workspace';
import CampaignLeadsPaginated from './CampaignLeadsPaginated';

type RunnerHealth = {
  state?: 'healthy' | 'stale' | 'failed' | 'idle';
  last_heartbeat_at?: string | null;
  claimed_count?: number;
  sent_count?: number;
  skipped_count?: number;
  failed_count?: number;
  fatal_error?: string | null;
  claim_reason?: string | null;
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
  open_rate_visible?: boolean;
  spam_hints?: string[];
};

type ProgressSummary = {
  total: number;
  groups: Array<{ status: string; current_step: number; count: number }>;
  lead_mix?: { eligible?: number; risky?: number; suppressed?: number };
};

function SectionSkeleton({ height = 'h-40' }: { height?: string }) {
  return <div className={`${height} animate-pulse rounded-xl border border-border bg-muted/40`} />;
}

async function DeliveryHealth({ campaignId }: { campaignId: string }) {
  const [healthResult, analyticsResult] = await Promise.allSettled([
    serverFetch<{ runner_health?: RunnerHealth }>(`/campaigns/${campaignId}/health-summary`),
    serverFetch<Analytics>(`/campaigns/${campaignId}/reply-open-analytics`, { timeoutMs: 20_000 }),
  ]);
  const runner = healthResult.status === 'fulfilled' ? healthResult.value.runner_health : undefined;
  const analytics = analyticsResult.status === 'fulfilled' ? analyticsResult.value : null;
  const state = runner?.state ?? 'idle';
  const stateClass = state === 'healthy'
    ? 'text-emerald-600 dark:text-emerald-300'
    : state === 'idle' ? 'text-muted-foreground' : 'text-rose-600 dark:text-rose-300';
  const metrics = [
    ['Sent', analytics?.sent ?? 0],
    ['Delivered', analytics?.delivered ?? 0],
    ['Opened', analytics?.open_rate_visible === false ? 'Unconfirmed' : analytics?.opened ?? 0],
    ['Replied', analytics?.replied ?? 0],
    ['Bounced', analytics?.bounced_total ?? 0],
  ];

  return (
    <section className="rounded-xl border border-border bg-card/50 p-4">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
        <div>
          <div className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Campaign runner</div>
          <div className={`mt-1 text-lg font-semibold capitalize ${stateClass}`}>{state}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {runner?.last_heartbeat_at ? `Last batch ${new Date(runner.last_heartbeat_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}` : 'No runner heartbeat recorded.'}
            {runner?.fatal_error || runner?.claim_reason ? ` · ${runner.fatal_error || runner.claim_reason}` : ''}
          </div>
        </div>
        <div className="grid grid-cols-4 gap-4 text-center text-xs">
          <div><span className="text-muted-foreground">Claimed</span><div className="font-semibold">{runner?.claimed_count ?? 0}</div></div>
          <div><span className="text-muted-foreground">Sent</span><div className="font-semibold">{runner?.sent_count ?? 0}</div></div>
          <div><span className="text-muted-foreground">Skipped</span><div className="font-semibold">{runner?.skipped_count ?? 0}</div></div>
          <div><span className="text-muted-foreground">Failed</span><div className="font-semibold">{runner?.failed_count ?? 0}</div></div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        {metrics.map(([label, value]) => <div key={String(label)} className="rounded-lg border border-border p-3"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 text-lg font-semibold">{value}</div></div>)}
      </div>
      {analyticsResult.status === 'rejected' ? <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">Delivery analytics are temporarily unavailable; the rest of the campaign remains usable.</p> : null}
      {analytics?.spam_hints?.length ? <p className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-xs text-amber-700 dark:text-amber-300">{analytics.spam_hints.join(' ')}</p> : null}
      <Link href={`/dashboard/campaign/replies?campaign_id=${campaignId}`} className="mt-3 inline-flex text-sm text-primary hover:underline">View replies</Link>
    </section>
  );
}

async function JourneySummary({ campaignId }: { campaignId: string }) {
  const [workspace, summary] = await Promise.all([
    getCampaignWorkspace(campaignId),
    serverFetch<ProgressSummary>(`/campaigns/${campaignId}/progress-summary`),
  ]);
  const steps = [...(workspace.sequence_steps ?? [])].sort((a, b) => Number(a.step_number ?? 0) - Number(b.step_number ?? 0));
  const groupsByStep = new Map<number, number>();
  for (const group of summary.groups ?? []) {
    const step = Math.max(1, Number(group.current_step ?? 1));
    groupsByStep.set(step, Number(groupsByStep.get(step) ?? 0) + Number(group.count ?? 0));
  }
  return (
    <section className="rounded-xl border border-border bg-card/50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div><h2 className="text-base font-semibold">Campaign Journey</h2><p className="text-xs text-muted-foreground">{workspace.sequence?.name ?? 'No sequence selected'} · aggregate progress</p></div>
        <div className="text-right"><div className="text-2xl font-semibold">{Number(summary.total ?? 0).toLocaleString()}</div><div className="text-xs text-muted-foreground">campaign leads</div></div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {steps.length === 0 ? <div className="text-sm text-muted-foreground">No sequence steps configured.</div> : steps.map((step, index) => {
          const stepNumber = Number(step.step_number ?? index + 1);
          return <div key={String(step.id ?? stepNumber)} className="rounded-lg border border-border p-3"><div className="text-xs text-muted-foreground">Step {stepNumber} · +{Number(step.delay_days ?? 0)}d</div><div className="mt-1 font-medium">{step.subject || 'Untitled step'}</div><div className="mt-2 text-xs text-muted-foreground">{Number(groupsByStep.get(stepNumber) ?? 0).toLocaleString()} currently at this step</div></div>;
        })}
      </div>
      <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span>Eligible: {Number(summary.lead_mix?.eligible ?? 0).toLocaleString()}</span>
        <span>Risky: {Number(summary.lead_mix?.risky ?? 0).toLocaleString()}</span>
        <span>Suppressed: {Number(summary.lead_mix?.suppressed ?? 0).toLocaleString()}</span>
      </div>
    </section>
  );
}

export default async function CampaignPage({ params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;
  const workspace = await getCampaignWorkspace(campaignId);
  return (
    <div className="space-y-6 px-8 py-6">
      <Suspense fallback={<SectionSkeleton />}><DeliveryHealth campaignId={campaignId} /></Suspense>
      <CampaignLeadsPaginated campaignId={campaignId} campaignStatus={workspace.campaign?.status} folders={workspace.lead_folders ?? []} />
      <Suspense fallback={<SectionSkeleton height="h-64" />}><JourneySummary campaignId={campaignId} /></Suspense>
    </div>
  );
}
