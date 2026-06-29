// config/tableActions.ts
'use server';

import { serverFetch } from '@/lib/server/server-fetch';
import { revalidatePath } from 'next/cache';


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

export async function reuseLead(row: any) {
  if (!row?.id) return { success: false, error: 'Missing lead id' };

  const result = await serverFetch<{
    success: boolean;
    lead_id: string;
    detached_count: number;
    blocked_running_count: number;
    remaining_count: number;
    reused: boolean;
  }>(`/leads/${row.id}/reuse`, { method: 'POST' });

  revalidatePath('/dashboard/leads');

  if (result.blocked_running_count > 0 && !result.reused) {
    return {
      success: false,
      error: `Lead detached from ${result.detached_count} old campaign(s), but ${result.blocked_running_count} running campaign link(s) still block reuse. Pause running campaign first.`,
    };
  }

  return { success: true };
}

export async function removeLeadSuppression(row: any) {
  if (!row?.id) return { success: false, error: 'Missing lead id' };

  const result = await serverFetch<{ success: boolean; requeued_count: number }>(
    `/leads/${row.id}/remove-suppression`,
    {
      method: 'POST',
      body: JSON.stringify({ confirm_explicit_consent: true }),
    }
  );
  revalidatePath('/dashboard/leads');
  return result.success
    ? { success: true }
    : { success: false, error: 'Failed to remove suppression' };
}
