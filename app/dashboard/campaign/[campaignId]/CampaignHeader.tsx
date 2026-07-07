'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Activity, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { clientFetch } from '@/lib/client-fetch';
import { pauseCampaignAction, startCampaignAction } from './actions';
import { toast } from 'react-hot-toast';

type CampaignHeaderProps = {
  campaign: {
    id: string;
    name: string;
    status: string;
  };
};

type BackendHealth = 'checking' | 'online' | 'offline';
type CampaignStatusResponse = {
  id: string;
  status: string;
  started_at?: string | null;
};

export default function CampaignHeader({ campaign }: CampaignHeaderProps) {
  const router = useRouter();
  const [status, setStatus] = useState(campaign.status);
  const [backendHealth, setBackendHealth] = useState<BackendHealth>('checking');
  const [submitting, setSubmitting] = useState(false);

  const canStart = status === 'draft' || status === 'paused';
  const canPause = status === 'running';

  useEffect(() => setStatus(campaign.status), [campaign.status]);

  const loadCampaignStatus = useCallback(async () => {
    const nextCampaign = await clientFetch<CampaignStatusResponse>(`/campaigns/${campaign.id}/status`);
    setStatus(String(nextCampaign.status ?? campaign.status).toLowerCase());
  }, [campaign.id, campaign.status]);

  const checkBackendHealth = useCallback(async () => {
    setBackendHealth('checking');
    try {
      await clientFetch<{ ok: boolean }>('/ping');
      setBackendHealth('online');
    } catch {
      setBackendHealth('offline');
    }
  }, []);

  useEffect(() => {
    void checkBackendHealth();
  }, [checkBackendHealth]);

  useEffect(() => {
    const refreshIfVisible = () => {
      if (document.hidden) return;
      void loadCampaignStatus().catch(() => undefined);
    };

    refreshIfVisible();
    const interval = window.setInterval(refreshIfVisible, 5_000);
    document.addEventListener('visibilitychange', refreshIfVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', refreshIfVisible);
    };
  }, [loadCampaignStatus]);

  async function handleStartPause() {
    if (submitting) return;
    const shouldStart = canStart;
    try {
      setSubmitting(true);
      const result = shouldStart
        ? await startCampaignAction(campaign.id)
        : await pauseCampaignAction(campaign.id);
      if (!result.success) throw new Error(result.error || 'Unable to update campaign status');

      setStatus(String(result.campaign?.status ?? (shouldStart ? 'running' : 'paused')).toLowerCase());
      toast.success(shouldStart ? 'Campaign started successfully.' : 'Campaign paused successfully.');
      void loadCampaignStatus().catch(() => undefined);
      if (shouldStart) {
        router.push(`/dashboard/campaign/${campaign.id}?tab=progress`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update campaign status');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <header className="rounded-2xl border border-border/60 bg-card/45 p-5 shadow-sm backdrop-blur-sm dark:border-white/[0.14] dark:bg-white/[0.055] dark:shadow-[0_18px_50px_rgb(0,0,0,0.38)]">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="truncate text-2xl font-bold tracking-tight">{campaign.name}</h1>
            <span className={cn(
              'rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider',
              status === 'draft' && 'border-border bg-muted text-muted-foreground',
              status === 'running' && 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
              status === 'paused' && 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
            )}>
              {status}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Configure delivery, then monitor projection and execution progress.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className={cn(
            'inline-flex h-9 items-center gap-2 rounded-md border px-3 text-xs',
            backendHealth === 'online' && 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
            backendHealth === 'offline' && 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-300',
            backendHealth === 'checking' && 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
          )}>
            <Activity className="size-4" aria-hidden="true" />
            {backendHealth === 'online' ? 'Backend online' : backendHealth === 'offline' ? 'Backend offline' : 'Checking backend'}
          </span>
          {backendHealth === 'offline' ? (
            <Button size="icon" variant="outline" onClick={() => void checkBackendHealth()} aria-label="Retry backend health check">
              <RefreshCw aria-hidden="true" />
            </Button>
          ) : null}
          {(canStart || canPause) ? (
            <Button
              type="button"
              variant={canPause ? 'destructive' : 'default'}
              disabled={submitting || backendHealth !== 'online'}
              onClick={() => void handleStartPause()}
            >
              {submitting ? (canStart ? 'Starting…' : 'Pausing…') : (canStart ? 'Start Campaign' : 'Pause Campaign')}
            </Button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
