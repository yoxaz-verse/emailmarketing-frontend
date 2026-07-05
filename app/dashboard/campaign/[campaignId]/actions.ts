'use server';

import { serverFetch } from '@/lib/server/server-fetch';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { getApiBaseUrl } from '@/lib/server/api-config';

export type CampaignAttachSummary = {
  requested: number;
  inserted: number;
  detached: number;
  skipped_existing: number;
  skipped_ineligible: number;
  skipped_missing: number;
  skipped_out_of_scope?: number;
};

export type CampaignAttachMutationSuccess = CampaignAttachSummary & {
  success: true;
};

export type CampaignAttachMutationFailure = CampaignAttachSummary & {
  success: false;
  error: string;
  statusCode?: number;
  raw?: string;
};

export type CampaignAttachMutationResult =
  | CampaignAttachMutationSuccess
  | CampaignAttachMutationFailure;

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

export type CampaignSenderSettings = {
  sender_display_name: string | null;
  effective_sender_display_name: string;
  warning: string | null;
  schema_ready?: boolean;
};
export type CampaignSenderSettingsUpdateResult =
  | ({ success: true } & CampaignSenderSettings)
  | { success: false; error: string; statusCode?: number };

function emptyAttachSummary(): CampaignAttachSummary {
  return {
    requested: 0,
    inserted: 0,
    detached: 0,
    skipped_existing: 0,
    skipped_ineligible: 0,
    skipped_missing: 0,
    skipped_out_of_scope: 0,
  };
}

function toAttachMutationFailure(
  err: unknown,
  campaignId: string,
  route: string
): CampaignAttachMutationFailure {
  const typedErr = err as { message?: string; statusCode?: number; raw?: string };
  const message = String(typedErr?.message ?? 'Failed to mutate campaign leads');
  const statusCode = typeof typedErr?.statusCode === 'number' ? typedErr.statusCode : undefined;
  const raw = typeof typedErr?.raw === 'string' ? typedErr.raw : undefined;
  console.error('[campaign lead mutation failed]', {
    campaignId,
    route,
    statusCode: statusCode ?? 'unknown',
  });
  return {
    ...emptyAttachSummary(),
    success: false,
    error: message,
    statusCode,
    raw,
  };
}

async function callCampaignAction(path: string): Promise<CampaignActionResult> {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;

  try {
    const res = await fetch(`${getApiBaseUrl()}${path}`, {
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
) : Promise<CampaignAttachMutationResult> {
  const route = `/campaigns/${campaignId}/leads/attach`;
  let result: CampaignAttachSummary;
  try {
    result = await serverFetch<CampaignAttachSummary>(route, {
      method: 'POST',
      body: JSON.stringify({ lead_ids: leadIds }),
    });
  } catch (err: unknown) {
    return toAttachMutationFailure(err, campaignId, route);
  }

  revalidatePath(`/dashboard/campaign/${campaignId}`);
  return { ...result, success: true };
}

export async function attachFolderLeadsAction(
  campaignId: string,
  folderIds: string[]
) : Promise<CampaignAttachMutationResult> {
  const route = `/campaigns/${campaignId}/leads/attach-folder`;
  let result: CampaignAttachSummary;
  try {
    result = await serverFetch<CampaignAttachSummary>(route, {
      method: 'POST',
      body: JSON.stringify({ folder_ids: folderIds }),
    });
  } catch (err: unknown) {
    return toAttachMutationFailure(err, campaignId, route);
  }

  revalidatePath(`/dashboard/campaign/${campaignId}`);
  return { ...result, success: true };
}

export async function detachLeadsAction(
  campaignId: string,
  leadIds: string[]
) : Promise<CampaignAttachMutationResult> {
  const route = `/campaigns/${campaignId}/leads/detach`;
  let result: CampaignAttachSummary;
  try {
    result = await serverFetch<CampaignAttachSummary>(route, {
      method: 'POST',
      body: JSON.stringify({ lead_ids: leadIds }),
    });
  } catch (err: unknown) {
    return toAttachMutationFailure(err, campaignId, route);
  }

  revalidatePath(`/dashboard/campaign/${campaignId}`);
  return { ...result, success: true };
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

export async function updateCampaignSenderSettings(
  campaignId: string,
  senderDisplayName: string
) {
  try {
    const result = await serverFetch<CampaignSenderSettings & { success: boolean }>(
      `/campaigns/${campaignId}/sender-settings`,
      {
        method: 'PATCH',
        body: JSON.stringify({ sender_display_name: senderDisplayName }),
      }
    );

    revalidatePath(`/dashboard/campaign/${campaignId}`);
    return result as CampaignSenderSettingsUpdateResult;
  } catch (err: any) {
    return {
      success: false,
      error: String(err?.message ?? 'Failed to update sender settings'),
      statusCode: Number.isFinite(Number(err?.statusCode)) ? Number(err.statusCode) : undefined,
    } as CampaignSenderSettingsUpdateResult;
  }
}
