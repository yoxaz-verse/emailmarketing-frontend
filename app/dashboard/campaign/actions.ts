'use server';

import { serverFetch } from '@/lib/server/server-fetch';
import { revalidatePath } from 'next/cache';

export async function startCampaign(row: any) {
  await serverFetch(`/campaigns/${row.id}/start`, {
    method: 'POST',
    body: JSON.stringify({ status: 'running' }),
  });

  revalidatePath('/dashboard/campaign');
}

export async function pauseCampaign(row: any) {
  await serverFetch(`/campaigns/${row.id}/pause`, {
    method: 'POST',
    body: JSON.stringify({ status: 'paused' }),
  });

  revalidatePath('/dashboard/campaign');
}
