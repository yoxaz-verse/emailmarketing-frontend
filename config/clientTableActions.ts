// config/clientTableActions.ts

'use client';

export async function viewCampaign(row: any) {
  if (!row?.id) return;
  window.location.href = `/dashboard/campaign/${row.id}`;
}

export async function viewSequence(row: any) {
  if (!row?.id) return;
  window.location.href = `/dashboard/sequences/${row.id}`;
}
