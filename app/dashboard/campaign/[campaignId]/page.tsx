import CampaignHeader from './CampaignHeader';
import LeadsTab from './LeadTab';
import CampaignJourneyMap from './CampaignJourneyMap';
import { serverFetch } from '@/lib/server/server-fetch';
import Link from 'next/link';

type SendingLimitsConfig = {
  schedule_enabled?: boolean;
  schedule_timezone?: string;
  allowed_weekdays?: number[];
  send_window_start?: string;
  send_window_end?: string;
  warmup_steps?: Array<{
    day: number;
    daily_limit: number;
    hourly_limit: number;
  }>;
};

type InterestStatus = 'unreviewed' | 'interested' | 'not_interested';

export default async function CampaignPage({
  params
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;

  try {
    /**
     * 1️⃣ Load campaign
     * CRUD returns array → take first
     */
    const campaign = (
      await serverFetch<any[]>(`/crud/campaigns?id=${campaignId}`)
    )[0];

    if (!campaign) {
      return (
        <div className="-mx-8 -my-8">
          <div className="px-8 py-8 text-sm text-muted-foreground">
            Campaign not found
          </div>
        </div>
      );
    }

    /**
     * 2️⃣ Load lead pool (operator + global shared)
     */
    const allLeads = await serverFetch<any[]>(
      `/crud/leads`
    );
    const leads = allLeads;

    /**
     * 3️⃣ Load campaign ↔ lead mappings
     */
    const campaignLeads = await serverFetch<any[]>(
      `/crud/campaign_leads?campaign_id=${campaign.id}`
    );
    const leadFolders = await serverFetch<any>(
      `/lead-folders`
    );

    /**
     * 4️⃣ Load ALL inboxes
     * (CRUD-safe, filter in code)
     */
    const allInboxes = await serverFetch<any[]>(
      `/crud/inboxes`
    );

    /**
     * 5️⃣ Filter inboxes
     * - public inboxes → operator_id === null
     * - private inboxes → operator_id === campaign.operator_id
     */
    const inboxes = allInboxes.filter((inbox) =>
      inbox.operator_id === null ||
      inbox.operator_id === campaign.operator_id
    );

    /**
     * 6️⃣ Load campaign ↔ inbox mappings
     * IMPORTANT:
     * This table now HAS `id`
     */
    const campaignInboxes = await serverFetch<any[]>(
      `/crud/campaign_inboxes?campaign_id=${campaign.id}`
    );
    let mutationHealth: {
      ok: boolean;
      reason?: string;
      routeContractVersion?: string;
    } = { ok: false, reason: 'Unknown health check failure' };
    try {
      const mutationHealthResponse = await serverFetch<{
        ok: boolean;
        diagnostics?: { route_contract_version?: string };
      }>(`/campaigns/${campaign.id}/mutation-health`);
      mutationHealth = {
        ok: mutationHealthResponse.ok === true,
        routeContractVersion: mutationHealthResponse?.diagnostics?.route_contract_version ?? 'campaign-mutations-v1',
      };
    } catch (error: any) {
      mutationHealth = {
        ok: false,
        reason: String(error?.message ?? 'Backend unavailable or stale campaign mutation routes'),
      };
    }
    const lockedInboxes = await serverFetch<Array<{
      inbox_id: string;
      blocking_campaign_id: string;
      blocking_campaign_name: string;
      blocking_status: string;
    }>>(`/campaigns/${campaign.id}/inbox-locks`);

    /**
     * 7️⃣ Load sequence + graph (for read-only steps)
     */
    let sequenceName = 'Sequence';
    let sequenceSteps: any[] = [];
    const hasSequenceId = Boolean(campaign.sequence_id);
    let sequenceResolved = false;

    if (hasSequenceId) {
      const sequenceId = String(campaign.sequence_id);
      const shortSequenceId = sequenceId.slice(0, 8);
      sequenceName = `Sequence ${shortSequenceId}`;

      try {
        sequenceSteps = await serverFetch<any[]>(
          `/crud/sequence_steps?sequence_id=${sequenceId}`
        );
      } catch (error) {
        console.warn('[CampaignPage] Failed to load sequence_steps for campaign', {
          campaignId: campaign.id,
          sequenceId,
          error,
        });
        sequenceSteps = [];
      }
      sequenceSteps.sort((a, b) => (a.step_number ?? 0) - (b.step_number ?? 0));

      try {
        let sequence: any = null;
        const sequences = await serverFetch<any[]>(
          `/crud/sequences?id=${sequenceId}`
        );
        sequence = sequences?.[0] ?? null;

        if (!sequence) {
          try {
            sequence = await serverFetch<any>(`/sequences/${sequenceId}`);
          } catch (fallbackError) {
            console.warn('[CampaignPage] /sequences/:id fallback failed', {
              campaignId: campaign.id,
              sequenceId,
              fallbackError,
            });
          }
        }

        if (sequence) {
          sequenceResolved = true;
          sequenceName = sequence.name ?? sequenceName;
        }
      } catch (error) {
        console.warn('[CampaignPage] Failed to resolve sequence metadata', {
          campaignId: campaign.id,
          sequenceId,
          error,
        });
      }
    }
    let sendingLimitsConfig: SendingLimitsConfig | null = null;
    try {
      sendingLimitsConfig = await serverFetch<SendingLimitsConfig>(
        '/admin/sending-limits'
      );
    } catch {
      sendingLimitsConfig = null;
    }
    let senderSettings: {
      sender_display_name: string | null;
      effective_sender_display_name: string;
      warning: string | null;
      schema_ready?: boolean;
    } = {
      sender_display_name: null,
      effective_sender_display_name: 'OBAOL Team',
      warning: null,
      schema_ready: true,
    };
    try {
      senderSettings = await serverFetch(`/campaigns/${campaign.id}/sender-settings`);
    } catch {
      senderSettings = {
        sender_display_name: null,
        effective_sender_display_name: 'OBAOL Team',
        warning: null,
        schema_ready: false,
      };
    }

    const leadById = new Map<string, any>();
    for (const lead of allLeads) {
      if (lead?.id) leadById.set(String(lead.id), lead);
    }
    const attachedLeadIds = campaignLeads.map((row) => String(row?.lead_id ?? '')).filter(Boolean);
    const attachedLeadRows = attachedLeadIds
      .map((id) => leadById.get(id))
      .filter(Boolean);
    const totalReplies = attachedLeadRows.filter((lead) => String(lead?.status ?? '').toLowerCase() === 'replied').length;
    const unreviewedReplies = attachedLeadRows.filter((lead) => (
      String(lead?.status ?? '').toLowerCase() === 'replied' &&
      String((lead?.interest_status ?? 'unreviewed') as InterestStatus).toLowerCase() === 'unreviewed'
    )).length;
    const interestedReplies = attachedLeadRows.filter((lead) => (
      String(lead?.status ?? '').toLowerCase() === 'replied' &&
      String((lead?.interest_status ?? '') as InterestStatus).toLowerCase() === 'interested'
    )).length;
    let replyOpenAnalytics: {
      sent: number;
      delivered: number;
      opened: number;
      not_opened: number;
      replied: number;
      not_replied: number;
      bounced_hard: number;
      bounced_soft: number;
      bounced_total: number;
      delivery_failed: number;
      pending_outcome: number;
      outcome_vs_step_mismatch: number;
      delivery_rate: number;
      bounce_rate: number;
      open_rate: number;
      open_rate_visible?: boolean;
      open_rate_visibility_reason?: string | null;
      open_confidence?: 'high' | 'medium' | 'low';
      reply_rate: number;
      spam_hints?: string[];
      outcome_rows?: Array<{
        campaign_lead_id: string;
        outcome: string;
        source?: string;
        confidence?: 'high' | 'medium' | 'low';
      }>;
    } | null = null;
    try {
      replyOpenAnalytics = await serverFetch(`/campaigns/${campaign.id}/reply-open-analytics`);
    } catch {
      replyOpenAnalytics = null;
    }

    const leadOutcomeByCampaignLeadId = new Map<string, string>();
    let lowConfidenceOutcomeCount = 0;
    for (const row of replyOpenAnalytics?.outcome_rows ?? []) {
      if (row?.campaign_lead_id) {
        leadOutcomeByCampaignLeadId.set(String(row.campaign_lead_id), String(row.outcome ?? ''));
      }
      if (row?.confidence === 'low') lowConfidenceOutcomeCount += 1;
    }

    const forbiddenSignoffRegex = /\b(joshua|jacob|jacob alwin joy|jacob supreme)\b/i;
    const hasForbiddenSignoff = (sequenceSteps ?? []).some((step: any) => forbiddenSignoffRegex.test(String(step?.body ?? '')));
    const senderLooksPersonal = /\b(joshua|jacob|alwin|joy)\b/i.test(String(senderSettings.sender_display_name ?? ''));
    const hasSenderMismatchRisk = hasForbiddenSignoff && !String(senderSettings.effective_sender_display_name ?? '').toLowerCase().includes('team');

    return (
      <div className="-mx-8 -my-8">
        <div className="px-8 py-8 space-y-6">
          {/* Campaign header + inbox selector */}
          <CampaignHeader
            campaign={campaign}
            inboxes={inboxes}
            campaignInboxes={campaignInboxes}
            lockedInboxes={lockedInboxes}
            senderSettings={senderSettings}
          />

          {/* Main layout */}
          <div className="space-y-6">
            <section className="rounded-xl border border-border bg-card/50 p-4">
              <div className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Delivery Health</div>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-4 gap-3 text-sm">
                <div className="rounded-lg border border-border px-3 py-2">
                  <div className="text-muted-foreground text-xs">Sent</div>
                  <div className="mt-1 text-base font-semibold text-foreground">{replyOpenAnalytics?.sent ?? 0}</div>
                </div>
                <div className="rounded-lg border border-border px-3 py-2">
                  <div className="text-muted-foreground text-xs">Delivered</div>
                  <div className="mt-1 text-base font-semibold text-emerald-300">{replyOpenAnalytics?.delivered ?? 0}</div>
                </div>
                <div className="rounded-lg border border-border px-3 py-2">
                  <div className="text-muted-foreground text-xs">Opened</div>
                  <div className="mt-1 text-base font-semibold text-sky-300">{replyOpenAnalytics?.opened ?? 0}</div>
                </div>
                <div className="rounded-lg border border-border px-3 py-2">
                  <div className="text-muted-foreground text-xs">Replied</div>
                  <div className="mt-1 text-base font-semibold text-sky-300">
                    {replyOpenAnalytics?.replied ?? totalReplies}
                  </div>
                </div>
              </div>
              {replyOpenAnalytics ? (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-4 gap-3 text-sm">
                  <div className="rounded-lg border border-border px-3 py-2">
                    <div className="text-muted-foreground text-xs">Hard Bounce</div>
                    <div className="mt-1 text-base font-semibold text-rose-300">{replyOpenAnalytics.bounced_hard}</div>
                  </div>
                  <div className="rounded-lg border border-border px-3 py-2">
                    <div className="text-muted-foreground text-xs">Soft Bounce</div>
                    <div className="mt-1 text-base font-semibold text-orange-300">{replyOpenAnalytics.bounced_soft}</div>
                  </div>
                  <div className="rounded-lg border border-border px-3 py-2">
                    <div className="text-muted-foreground text-xs">Pending Outcome</div>
                    <div className="mt-1 text-base font-semibold text-amber-300">{replyOpenAnalytics.pending_outcome}</div>
                  </div>
                  <div className="rounded-lg border border-border px-3 py-2">
                    <div className="text-muted-foreground text-xs">Step/Outcome Mismatch</div>
                    <div className="mt-1 text-base font-semibold text-yellow-300">{replyOpenAnalytics.outcome_vs_step_mismatch}</div>
                  </div>
                </div>
              ) : null}
              {replyOpenAnalytics ? (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-4 gap-3 text-sm">
                  <div className="rounded-lg border border-border px-3 py-2">
                    <div className="text-muted-foreground text-xs">Delivery Rate</div>
                    <div className="mt-1 text-base font-semibold text-emerald-300">{replyOpenAnalytics.delivery_rate}%</div>
                  </div>
                  <div className="rounded-lg border border-border px-3 py-2">
                    <div className="text-muted-foreground text-xs">Open Rate</div>
                    <div className="mt-1 text-base font-semibold text-sky-300">
                      {replyOpenAnalytics.open_rate_visible === false ? 'Hidden' : `${replyOpenAnalytics.open_rate}%`}
                    </div>
                  </div>
                  <div className="rounded-lg border border-border px-3 py-2">
                    <div className="text-muted-foreground text-xs">Reply Rate</div>
                    <div className="mt-1 text-base font-semibold text-cyan-300">{replyOpenAnalytics.reply_rate}%</div>
                  </div>
                  <div className="rounded-lg border border-border px-3 py-2">
                    <div className="text-muted-foreground text-xs">Bounce Rate</div>
                    <div className="mt-1 text-base font-semibold text-rose-300">{replyOpenAnalytics.bounce_rate}%</div>
                  </div>
                </div>
              ) : null}
              <div className="mt-3 rounded-lg border border-border px-3 py-2 text-xs">
                <span className="text-muted-foreground">Tracking confidence:</span>{' '}
                <span className={lowConfidenceOutcomeCount > 0 ? 'text-amber-300' : 'text-emerald-300'}>
                  {replyOpenAnalytics?.open_confidence === 'low'
                    ? 'Low confidence: open events are not confirmed yet.'
                    : lowConfidenceOutcomeCount > 0
                    ? `${lowConfidenceOutcomeCount} low-confidence outcomes (fallback match/pixel)`
                    : 'All matched outcomes high confidence'}
                </span>
              </div>
              {replyOpenAnalytics?.open_rate_visible === false && replyOpenAnalytics?.open_rate_visibility_reason ? (
                <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-200">
                  {replyOpenAnalytics.open_rate_visibility_reason}
                </div>
              ) : null}
              <div className="mt-3 rounded-lg border border-border px-3 py-2 text-xs">
                <span className="text-muted-foreground">Content lint:</span>{' '}
                <span className={(hasSenderMismatchRisk || senderLooksPersonal) ? 'text-rose-300' : 'text-emerald-300'}>
                  {(hasSenderMismatchRisk || senderLooksPersonal)
                    ? 'Potential identity mismatch: personal sender/sign-off detected. Recommended brand/team sender.'
                    : `Sender identity compliant (${senderSettings.effective_sender_display_name || 'OBAOL Team'}).`}
                </span>
              </div>
              {replyOpenAnalytics?.spam_hints && replyOpenAnalytics.spam_hints.length > 0 ? (
                <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-200">
                  {replyOpenAnalytics.spam_hints.join(' ')}
                </div>
              ) : null}
              <div className="mt-3">
                <Link
                  href={`/dashboard/campaign/replies?campaign_id=${campaign.id}`}
                  className="inline-flex h-9 items-center rounded border border-border px-3 text-sm text-foreground hover:bg-muted"
                >
                  View Replies
                </Link>
              </div>
            </section>
            <LeadsTab
              campaign={campaign}
              leads={leads}
              allLeads={allLeads}
              campaignLeads={campaignLeads}
              leadFolders={leadFolders?.folders ?? []}
              mutationHealth={mutationHealth}
            />
            <CampaignJourneyMap
              campaign={campaign}
              sequenceId={campaign.sequence_id ?? null}
              hasSequenceId={hasSequenceId}
              sequenceResolved={sequenceResolved}
              sequenceName={sequenceName}
              sequenceSteps={sequenceSteps}
                campaignLeads={campaignLeads}
                allLeads={allLeads}
                inboxes={inboxes}
                campaignInboxes={campaignInboxes}
                sendingLimitsConfig={sendingLimitsConfig}
                leadOutcomeByCampaignLeadId={Object.fromEntries(leadOutcomeByCampaignLeadId)}
              />
          </div>
        </div>
      </div>
    );
  } catch (error: any) {
    return (
      <div className="-mx-8 -my-8">
        <div className="px-8 py-8">
          <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground space-y-2">
            <div className="text-base font-semibold text-foreground">
              Unable to load campaign
            </div>
            <div>{error?.message ?? 'Unknown error'}</div>
            <a className="text-blue-300 hover:text-blue-200 underline" href="/dashboard/campaign">
              Back to campaigns
            </a>
          </div>
        </div>
      </div>
    );
  }
}
