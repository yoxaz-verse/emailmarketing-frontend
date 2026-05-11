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

  const response = await serverFetch<any>(
    `/validate/domains`,
    {
      method: 'POST',
      body: JSON.stringify({ domain: row.domain,domain_id: row.id }),
    }
  );
  // Refresh domains table
  revalidatePath('/dashboard/sending-domains');

  if (!response?.data?.hasDkim) {
    const failureReason = response?.data?.dkimFailureReason;
    const lookupHost = response?.data?.dkimLookupHost;
    return {
      error: failureReason
        ? failureReason
        : lookupHost
        ? `DKIM lookup failed: ${lookupHost}`
        : 'DKIM lookup failed',
    };
  }

  return { success: true };
}

export async function viewSequence(row: any) {
  // ✅ FIX: use row.id
  redirect(`/dashboard/sequences/${row.id}`);
}

export async function enableSequence(row: any) {
  await serverFetch(
    `/admin/sequence/${row.id}/enable`,
    { method: 'POST' }
  );
  revalidatePath('/dashboard/sequences');
}

export async function disableSequence(row: any) {
  await serverFetch(
    `/admin/sequence/${row.id}/disable`,
    { method: 'POST' }
  );
  revalidatePath('/dashboard/sequences');
}

export async function publishNewsletterIssue(row: any) {
  await serverFetch(`/newsletter/issues/${row.id}/publish`, { method: 'POST' });
  revalidatePath('/dashboard/newsletter_issues');
}

export async function runNewsletterIssueNow(row: any) {
  await serverFetch(`/newsletter/issues/${row.id}/run-now`, { method: 'POST' });
  revalidatePath('/dashboard/newsletter_issues');
  revalidatePath('/dashboard/newsletter_send_jobs');
}

export async function pauseNewsletterIssue(row: any) {
  await serverFetch(`/newsletter/issues/${row.id}/pause`, { method: 'POST' });
  revalidatePath('/dashboard/newsletter_issues');
}

export async function resumeNewsletterIssue(row: any) {
  await serverFetch(`/newsletter/issues/${row.id}/resume`, { method: 'POST' });
  revalidatePath('/dashboard/newsletter_issues');
}
