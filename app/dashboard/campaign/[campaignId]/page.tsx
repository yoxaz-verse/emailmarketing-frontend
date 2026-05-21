import CampaignHeader from './CampaignHeader';
import LeadsTab from './LeadTab';
import CampaignJourneyMap from './CampaignJourneyMap';
import { serverFetch } from '@/lib/server/server-fetch';

type SendingLimitsConfig = {
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

    return (
      <div className="-mx-8 -my-8">
        <div className="px-8 py-8 space-y-6">
          {/* Campaign header + inbox selector */}
          <CampaignHeader
            campaign={campaign}
            inboxes={inboxes}
            campaignInboxes={campaignInboxes}
            lockedInboxes={lockedInboxes}
          />

          {/* Main layout */}
          <div className="space-y-6">
            <section className="rounded-xl border border-border bg-card/50 p-4">
              <div className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Reply Summary</div>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                <div className="rounded-lg border border-border px-3 py-2">
                  <div className="text-muted-foreground text-xs">Total Replies</div>
                  <div className="mt-1 text-base font-semibold text-foreground">{totalReplies}</div>
                </div>
                <div className="rounded-lg border border-border px-3 py-2">
                  <div className="text-muted-foreground text-xs">Unreviewed</div>
                  <div className="mt-1 text-base font-semibold text-amber-300">{unreviewedReplies}</div>
                </div>
                <div className="rounded-lg border border-border px-3 py-2">
                  <div className="text-muted-foreground text-xs">Interested</div>
                  <div className="mt-1 text-base font-semibold text-emerald-300">{interestedReplies}</div>
                </div>
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
