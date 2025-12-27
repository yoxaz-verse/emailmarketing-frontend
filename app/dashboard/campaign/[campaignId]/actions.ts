'use server';

import { serverFetch } from '@/lib/server-fetch';
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
