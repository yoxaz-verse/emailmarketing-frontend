import Link from 'next/link';
import { getCampaignWorkspace } from '@/lib/server/campaign-workspace';
import { serverFetch } from '@/lib/server/server-fetch';
import CampaignSetup from './CampaignSetup';
import CampaignLeadsPaginated from './CampaignLeadsPaginated';
import CampaignProgress from './CampaignProgress';

type RunnerHealthResponse = { runner_health?: Parameters<typeof CampaignProgress>[0]['runner'] };
type Analytics = Parameters<typeof CampaignProgress>[0]['analytics'];
type ProgressSummary = Parameters<typeof CampaignProgress>[0]['summary'];

function CampaignTabs({ campaignId, active }: { campaignId: string; active: 'setup' | 'progress' }) {
  return (
    <nav className="inline-flex rounded-xl border border-border bg-card/50 p-1 dark:border-white/[0.14] dark:bg-white/[0.055] dark:shadow-inner dark:shadow-black/40" aria-label="Campaign workspace tabs">
      {(['setup', 'progress'] as const).map((tab) => (
        <Link
          key={tab}
          href={`/dashboard/campaign/${campaignId}?tab=${tab}`}
          aria-current={active === tab ? 'page' : undefined}
          className={`rounded-lg px-5 py-2 text-sm font-medium capitalize transition-colors ${active === tab ? 'bg-primary text-primary-foreground shadow-sm dark:shadow-primary/25' : 'text-muted-foreground hover:bg-muted hover:text-foreground dark:hover:bg-white/[0.075]'}`}
        >
          {tab}
        </Link>
      ))}
    </nav>
  );
}

export default async function CampaignPage({
  params,
  searchParams,
}: {
  params: Promise<{ campaignId: string }>;
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const [{ campaignId }, query] = await Promise.all([params, searchParams]);
  const workspace = await getCampaignWorkspace(campaignId);
  const requestedTab = Array.isArray(query.tab) ? query.tab[0] : query.tab;
  const campaignStatus = String(workspace.campaign?.status ?? 'draft').toLowerCase();
  const defaultTab = campaignStatus === 'draft' ? 'setup' : 'progress';
  const activeTab: 'setup' | 'progress' = requestedTab === 'setup' || requestedTab === 'progress' ? requestedTab : defaultTab;

  return (
    <div className="space-y-6 px-8 py-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div><h2 className="text-lg font-semibold">Campaign workspace</h2><p className="text-sm text-muted-foreground">Separate configuration from projections and live execution.</p></div>
        <CampaignTabs campaignId={campaignId} active={activeTab} />
      </div>

      {activeTab === 'setup' ? (
        <>
          <CampaignSetup
            campaign={workspace.campaign}
            assignedOperatorName={workspace.assigned_operator_name}
            sequence={workspace.sequence}
            sequenceStepCount={workspace.sequence_steps.length}
            senderSettings={workspace.sender_settings}
            inboxes={workspace.inboxes}
            campaignInboxes={workspace.campaign_inboxes}
            lockedInboxes={workspace.locked_inboxes}
          />
          <CampaignLeadsPaginated
            campaignId={campaignId}
            campaignStatus={workspace.campaign?.status}
            folders={workspace.lead_folders ?? []}
          />
        </>
      ) : (
        <ProgressContent campaignId={campaignId} workspace={workspace} />
      )}
    </div>
  );
}

async function ProgressContent({ campaignId, workspace }: { campaignId: string; workspace: Awaited<ReturnType<typeof getCampaignWorkspace>> }) {
  const [healthResult, analyticsResult, summaryResult] = await Promise.allSettled([
    serverFetch<RunnerHealthResponse>(`/campaigns/${campaignId}/health-summary`),
    serverFetch<Analytics>(`/campaigns/${campaignId}/reply-open-analytics`, { timeoutMs: 20_000 }),
    serverFetch<ProgressSummary>(`/campaigns/${campaignId}/progress-summary`),
  ]);
  const emptySummary: ProgressSummary = { total: 0, groups: [], lead_mix: { eligible: 0, risky: 0, suppressed: 0 }, rounds: [] };

  return (
    <CampaignProgress
      campaignId={campaignId}
      campaign={workspace.campaign}
      sequence={workspace.sequence}
      sequenceSteps={workspace.sequence_steps}
      inboxes={workspace.inboxes}
      campaignInboxes={workspace.campaign_inboxes}
      sendingLimits={workspace.sending_limits}
      runner={healthResult.status === 'fulfilled' ? healthResult.value.runner_health ?? null : null}
      analytics={analyticsResult.status === 'fulfilled' ? analyticsResult.value : null}
      summary={summaryResult.status === 'fulfilled' ? summaryResult.value : emptySummary}
      availability={{ health: healthResult.status === 'fulfilled', analytics: analyticsResult.status === 'fulfilled', summary: summaryResult.status === 'fulfilled' }}
      projectionAnchorIso={new Date().toISOString()}
    />
  );
}
