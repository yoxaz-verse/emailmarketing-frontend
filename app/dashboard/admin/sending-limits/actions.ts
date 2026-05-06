'use server';

import { revalidatePath } from 'next/cache';
import { serverFetch } from '@/lib/server/server-fetch';

export async function updateSendingLimits(payload: any) {
  try {
    const config = await serverFetch('/admin/sending-limits', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });

    revalidatePath('/dashboard/admin/sending-limits');
    return { success: true, config };
  } catch (err: any) {
    return { success: false, error: err?.message ?? 'Failed to update sending limits' };
  }
}
