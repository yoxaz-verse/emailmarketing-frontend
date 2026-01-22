// config/serverActions.ts
'use server';

import { serverFetch } from '@/lib/server/server-fetch';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';


export async function viewCampaign(row: any) {
  redirect(`/dashboard/campaign/${row.id}`);
}


export async function validateSmtpAccount(row: any) {
  await serverFetch(
    `/validate/smtp-accounts/${row.id}`,
    { method: 'POST' }
  );
  revalidatePath('/dashboard/smtp-accounts');
}

export async function validateSendingDomain(row: any) {
  if (!row?.domain) return;

  await serverFetch(
    `/validate/domains`,
    {
      method: 'POST',
      body: JSON.stringify({ domain: row.domain,domain_id: row.id }),
    }
  );
  // Refresh domains table
  revalidatePath('/dashboard/sending-domains');
}

export async function viewSequence(row: any) {
  // ✅ FIX: use row.id
  redirect(`/dashboard/sequences/${row.id}`);
}

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
