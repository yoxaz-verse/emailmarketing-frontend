'use server';

import { cookies } from 'next/headers';
import { serverFetch } from '@/lib/server/server-fetch';

type Lead = {
  email: string;
  first_name: string;
  company: string;
  country: string;
  phone?: string;
  company_description?: string;
};

export async function uploadLeadsAction(
  leads: Lead[],
  operatorId?: string,
  duplicateMode: 'skip' | 'replace' = 'skip'
) {
  if (!leads || leads.length === 0) {
    throw new Error('No leads provided');
  }

  // Admin may pass operatorId, worker cannot
  const body: any = { leads, duplicate_mode: duplicateMode };
  if (operatorId) body.operator_id = operatorId;

  await serverFetch('/operator/leads/upload', {
    method: 'POST',
    body: JSON.stringify(body)
  });

  return { success: true };
}
