import CampaignHeader from './CampaignHeader';
import AnalyticsTab from './AnalyticsTab';
import { serverFetch } from '@/lib/server-fetch';
import LeadsTab from './LeadTab';



export default async function CampaignPage({
  params
}: {
  params: Promise<{ campaignId: string }>;
}) {
  /**
   * 1️⃣ Load campaign (single row via CRUD)
   * CRUD always returns array → take first
   */
  const { campaignId } = await params;

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
console.log("campaign", campaign);

  /**
   * 2️⃣ Load operator leads
   * These are the selectable leads for this campaign
   */
  const leads = await serverFetch<any[]>(
    `/crud/leads?operator_id=${campaign.operator_id}`
  );

  console.log("leads",leads);
  
  /**
   * 3️⃣ Load campaign_leads (mapping table)
   * This tells which leads are already attached
   */
  const campaignLeads = await serverFetch<any[]>(
    `/crud/campaign_leads?campaign_id=${campaign.id}`
  );

  return (
    <div className="space-y-6">
      {/* Campaign control header */}
      <CampaignHeader campaign={campaign} />

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Leads management */}
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
