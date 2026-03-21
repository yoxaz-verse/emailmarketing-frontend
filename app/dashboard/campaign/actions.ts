'use server';

import { serverFetch } from '@/lib/server/server-fetch';
import { revalidatePath } from 'next/cache';

export async function startCampaign(row: any) {
  try {
    await serverFetch(`/campaigns/${row.id}/start`, {
      method: 'POST',
      body: JSON.stringify({ status: 'running' }),
    });
    revalidatePath('/dashboard/campaign');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message ?? 'Failed to start campaign' };
  }
}

export async function pauseCampaign(row: any) {
  try {
    await serverFetch(`/campaigns/${row.id}/pause`, {
      method: 'POST',
      body: JSON.stringify({ status: 'paused' }),
    });
    revalidatePath('/dashboard/campaign');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message ?? 'Failed to pause campaign' };
  }
}
