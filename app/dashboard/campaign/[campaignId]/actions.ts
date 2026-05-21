'use server';

import { serverFetch } from '@/lib/server/server-fetch';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';

export type CampaignAttachSummary = {
  success: boolean;
  requested: number;
  inserted: number;
  detached: number;
  skipped_existing: number;
  skipped_ineligible: number;
  skipped_missing: number;
  skipped_out_of_scope?: number;
};

export type CampaignMutationHealth = {
  ok: boolean;
  campaign_id: string;
  diagnostics: {
    api_base_configured: boolean;
    route_contract_version: string;
    required_routes: {
      attach: string;
      detach: string;
      attach_folder: string;
      campaign_delete: string;
    };
  };
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

export type CampaignActionResult = {
  success: boolean;
  error?: string;
  statusCode?: number;
};

async function callCampaignAction(path: string): Promise<CampaignActionResult> {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;

  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (res.ok) return { success: true };

    const raw = await res.text();
    let parsed: { error?: string; message?: string } | null = null;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      parsed = null;
    }

    return {
      success: false,
      error: String((parsed?.error ?? parsed?.message ?? raw) || 'Campaign action failed'),
      statusCode: res.status,
    };
  } catch (err: unknown) {
    const typedErr = err as { message?: string };
    return {
      success: false,
      error: String(typedErr?.message ?? 'Campaign action failed'),
    };
  }
}

export async function startCampaignAction(campaignId: string): Promise<CampaignActionResult> {
  const result = await callCampaignAction(`/campaigns/${campaignId}/start`);
  if (result.success) {
    revalidatePath(`/dashboard/campaign/${campaignId}`);
  }
  return result;
}

export async function pauseCampaignAction(campaignId: string): Promise<CampaignActionResult> {
  const result = await callCampaignAction(`/campaigns/${campaignId}/pause`);
  if (result.success) {
    revalidatePath(`/dashboard/campaign/${campaignId}`);
  }
  return result;
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

export async function getCampaignMutationHealth(
  campaignId: string
) {
  return serverFetch<CampaignMutationHealth>(`/campaigns/${campaignId}/mutation-health`, {
    method: 'GET',
  });
}
