'use server';

import { revalidatePath } from 'next/cache';
import { serverFetch } from '@/lib/server/server-fetch';

export async function reviewReplyInterestAction(input: {
  leadId: string;
  interest_status: 'unreviewed' | 'interested' | 'not_interested';
  interest_note?: string;
}) {
  const result = await serverFetch<{ success: boolean }>(`/operator/replies/${input.leadId}/review`, {
    method: 'PATCH',
    body: JSON.stringify({
      interest_status: input.interest_status,
      interest_note: input.interest_note ?? null,
    }),
  });

  revalidatePath('/dashboard/campaign/replies');
  return result;
}

export async function mapUnmatchedReplyAction(input: {
  replyEventId: string;
  lead_id?: string;
  lead_email?: string;
  campaign_lead_id?: string;
}) {
  const result = await serverFetch<{ success: boolean }>(
    `/operator/replies/unmatched/${input.replyEventId}/map`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        lead_id: input.lead_id ?? null,
        lead_email: input.lead_email ?? null,
        campaign_lead_id: input.campaign_lead_id ?? null,
      }),
    }
  );

  revalidatePath('/dashboard/campaign/replies');
  return result;
}
