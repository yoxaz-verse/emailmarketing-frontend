// config/serverActions.ts
'use server';

import { serverFetch } from '@/lib/server-fetch';
import { revalidatePath } from 'next/cache';

export async function enableSequence(row: any) {
  await serverFetch(
    `/admin/sequence/${row.sequence_id}/enable`,
    { method: 'POST' }
  );
  revalidatePath('/dashboard/sequences');
}

export async function disableSequence(row: any) {
  await serverFetch(
    `/admin/sequence/${row.sequence_id}/disable`,
    { method: 'POST' }
  );
  revalidatePath('/dashboard/sequences');
}
