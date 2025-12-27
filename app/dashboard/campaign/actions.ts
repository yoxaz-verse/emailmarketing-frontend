'use server';

import { serverFetch } from '@/lib/server-fetch';
import { revalidatePath } from 'next/cache';

export async function startCampaign(row: any) {
  await serverFetch(`/crud/campaigns/${row.id}`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'running' }),
  });

  revalidatePath('/dashboard/campaign');
}

export async function pauseCampaign(row: any) {
  await serverFetch(`/crud/campaigns/${row.id}`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'paused' }),
  });

  revalidatePath('/dashboard/campaign');
}
