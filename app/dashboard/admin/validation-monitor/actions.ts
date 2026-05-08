'use server';

import { revalidatePath } from 'next/cache';
import { serverFetch } from '@/lib/server/server-fetch';

export type ValidationMonitorPayload = {
  success: boolean;
  run: any | null;
  history: any[];
  metrics: {
    runAgeSeconds: number;
    pendingAvailable: number;
    processingNow: number;
    recentUpdates: number;
    totalLeads: number;
  };
  reasons: {
    topReasons: Array<{ reason: string; count: number }>;
    stepFailureCounts: Record<string, number>;
    mostFailedStep: {
      key: string;
      label: string;
      count: number;
    } | null;
  };
  runtime: {
    executionMode: 'inline_sync';
    flow: string;
  };
  diagnosis: string[];
};

export async function getValidationMonitorAction() {
  return await serverFetch<ValidationMonitorPayload>('/admin/validation/monitor', {
    method: 'GET',
  });
}

export async function rerunFailedValidationMonitorAction() {
  const payload = await serverFetch<{ success: boolean; queued: number; runId: string; message: string }>('/validate/lead/start', {
    method: 'POST',
    body: JSON.stringify({ mode: 'rerun_failed' }),
  });
  revalidatePath('/dashboard/admin/validation-monitor');
  return payload;
}

export async function resetStuckAndRerunValidationMonitorAction() {
  const payload = await serverFetch<{ success: boolean; queued: number; runId: string; message: string }>('/validate/lead/reset-stuck-rerun', {
    method: 'POST',
    body: JSON.stringify({}),
  });
  revalidatePath('/dashboard/admin/validation-monitor');
  return payload;
}
