import CampaignHeader from './CampaignHeader';
import AnalyticsTab from './AnalyticsTab';
import LeadsTab from './LeadTab';
import { serverFetch } from '@/lib/server-fetch';

export default async function CampaignPage({
  params
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;

  /**
   * 1️⃣ Load campaign
   * CRUD returns array → take first
   */
  const campaign = (
    await serverFetch<any[]>(`/crud/campaigns?id=${campaignId}`)
  )[0];

  if (!campaign) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Campaign not found
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

  return (
    <div className="space-y-6">
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

        {/* Analytics */}
        <AnalyticsTab campaignId={campaign.id} />
      </div>
    </div>
  );
}
