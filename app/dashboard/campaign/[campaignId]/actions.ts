'use server';

import { serverFetch } from '@/lib/server/server-fetch';
import { revalidatePath } from 'next/cache';

export type CampaignAttachSummary = {
  success: boolean;
  requested: number;
  inserted: number;
  detached: number;
  skipped_existing: number;
  skipped_ineligible: number;
  skipped_missing: number;
};

export type CampaignInboxSyncSummary = {
  success: boolean;
  campaign_id: string;
  selected: number;
  attached: number;
  detached: number;
  unchanged: number;
  errors: string[];
  code?: string;
  conflicts?: Array<{
    inbox_id: string;
    email_address: string;
    blocking_campaign_id: string;
    blocking_campaign_name: string;
    blocking_status: string;
  }>;
};

export async function startCampaignAction(campaignId: string) {
  await serverFetch(`/campaigns/${campaignId}/start`, {
    method: 'POST',
  });

  revalidatePath(`/dashboard/campaign/${campaignId}`);
}

export async function pauseCampaignAction(campaignId: string) {
  await serverFetch(`/campaigns/${campaignId}/pause`, {
    method: 'POST',
  });

  revalidatePath(`/dashboard/campaign/${campaignId}`);
}

export async function attachLeadsAction(
  campaignId: string,
  leadIds: string[]
) {
  const result = await serverFetch<CampaignAttachSummary>(`/campaigns/${campaignId}/leads/attach`, {
    method: 'POST',
    body: JSON.stringify({ lead_ids: leadIds }),
  });

  revalidatePath(`/dashboard/campaign/${campaignId}`);
  return result;
}

export async function attachFolderLeadsAction(
  campaignId: string,
  folderIds: string[]
) {
  const result = await serverFetch<CampaignAttachSummary>(`/campaigns/${campaignId}/leads/attach-folder`, {
    method: 'POST',
    body: JSON.stringify({ folder_ids: folderIds }),
  });

  revalidatePath(`/dashboard/campaign/${campaignId}`);
  return result;
}

export async function detachLeadsAction(
  campaignId: string,
  leadIds: string[]
) {
  const result = await serverFetch<CampaignAttachSummary>(`/campaigns/${campaignId}/leads/detach`, {
    method: 'POST',
    body: JSON.stringify({ lead_ids: leadIds }),
  });

  revalidatePath(`/dashboard/campaign/${campaignId}`);
  return result;
}

export async function updateCampaignInboxes(
  campaignId: string,
  selectedInboxIds: string[]
) {
  let result: CampaignInboxSyncSummary;
  try {
    result = await serverFetch<CampaignInboxSyncSummary>(
      `/campaigns/${campaignId}/inboxes/sync`,
      {
        method: 'POST',
        body: JSON.stringify({ selected_inbox_ids: selectedInboxIds }),
      }
    );
  } catch (err: unknown) {
    const typedErr = err as { raw?: string; message?: string };
    let parsed: { error?: string; code?: string; conflicts?: unknown } | null = null;
    try {
      parsed = typedErr?.raw ? JSON.parse(String(typedErr.raw)) : null;
    } catch {
      parsed = null;
    }
    return {
      success: false,
      campaign_id: campaignId,
      selected: selectedInboxIds.length,
      attached: 0,
      detached: 0,
      unchanged: 0,
      errors: [String(parsed?.error ?? typedErr?.message ?? 'Failed to sync campaign inboxes')],
      code: parsed?.code,
      conflicts: Array.isArray(parsed?.conflicts) ? parsed.conflicts : [],
    };
  }

  revalidatePath(`/dashboard/campaign/${campaignId}`);
  return result;
}
