'use server';

import { serverFetch } from '@/lib/server/server-fetch';
import { revalidatePath } from 'next/cache';

export async function startCampaignAction(campaignId: string) {
  await serverFetch(`/campaigns/${campaignId}/start`, {
    method: 'POST',
  });

  revalidatePath(`/dashboard/campaigns/${campaignId}`);
}

export async function pauseCampaignAction(campaignId: string) {
  await serverFetch(`/campaigns/${campaignId}/pause`, {
    method: 'POST',
  });

  revalidatePath(`/dashboard/campaigns/${campaignId}`);
}

export async function attachLeadsAction(
  campaignId: string,
  leadIds: string[]
) {
  await serverFetch(`/campaigns/${campaignId}/leads/attach`, {
    method: 'POST',
    body: JSON.stringify({ lead_ids: leadIds }),
  });

  revalidatePath(`/dashboard/campaigns/${campaignId}`);
}



import { crudServer } from '@/lib/crud-server';

export async function updateCampaignInboxes(
  campaignId: string,
  toAttach: string[],
  toDetach: string[]
) {
  // Attach new inboxes
  for (const inboxId of toAttach) {
    await crudServer.create('campaign_inboxes', {
      campaign_id: campaignId,
      inbox_id: inboxId
    });
  }

  // Detach removed inboxes
  for (const campaignInboxId of toDetach) {
    await crudServer.delete('campaign_inboxes', campaignInboxId);
  }

  revalidatePath(`/dashboard/campaign/${campaignId}`);
}
