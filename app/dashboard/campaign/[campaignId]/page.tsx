import CampaignHeader from './CampaignHeader';
import AnalyticsTab from './AnalyticsTab';
import LeadsTab from './LeadTab';
import { serverFetch } from '@/lib/server/server-fetch';

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
     * 2️⃣ Load operator leads
     */
    const leads = await serverFetch<any[]>(
      `/crud/leads?operator_id=${campaign.operator_id}`
    );

    /**
     * 3️⃣ Load campaign ↔ lead mappings
     */
    const campaignLeads = await serverFetch<any[]>(
      `/crud/campaign_leads?campaign_id=${campaign.id}`
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

    /**
     * 7️⃣ Load sequence + graph (for read-only steps)
     */
    let sequenceName = 'Sequence';
    let sequenceSteps: any[] = [];
    if (campaign.sequence_id) {
      const sequences = await serverFetch<any[]>(
        `/crud/sequences?id=${campaign.sequence_id}`
      );
      const sequence = sequences?.[0];
      if (sequence) {
        sequenceName = sequence.name ?? sequenceName;
        sequenceSteps = await serverFetch<any[]>(
          `/crud/sequence_steps?sequence_id=${campaign.sequence_id}`
        );
        sequenceSteps.sort((a, b) => (a.step_number ?? 0) - (b.step_number ?? 0));
      }
    }

    return (
      <div className="-mx-8 -my-8">
        <div className="px-8 py-8 space-y-6">
          {/* Campaign header + inbox selector */}
          <CampaignHeader
            campaign={campaign}
            inboxes={inboxes}
            campaignInboxes={campaignInboxes}
          />

          {/* Main layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Leads */}
            <div className="lg:col-span-2">
              <LeadsTab
                campaign={campaign}
                leads={leads}
                campaignLeads={campaignLeads}
              />
            </div>

            {/* Sequence + Analytics */}
            <div className="space-y-6">
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Sequence Steps</h3>
                  <span className="text-xs text-muted-foreground">
                    {sequenceName}
                  </span>
                </div>
                {sequenceSteps.length === 0 ? (
                  <p className="mt-3 text-xs text-muted-foreground">
                    No sequence steps yet.
                  </p>
                ) : (
                  <ol className="mt-3 space-y-2 text-sm">
                    {sequenceSteps.map((step, index) => {
                      return (
                        <li key={step.id ?? index} className="rounded-md border border-border bg-muted/40 p-2">
                          <div className="text-xs text-muted-foreground">
                            Step {step.step_number ?? index + 1}
                          </div>
                          <div className="font-medium">
                            {step.subject?.trim() ? step.subject : 'Untitled Email'}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Delay: {step.delay_days ?? 0} day(s)
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </div>

              <AnalyticsTab campaignId={campaign.id} />
            </div>
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
