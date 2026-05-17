'use client';

import { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { pauseCampaignAction, startCampaignAction, updateCampaignInboxes } from './actions';
import { Check, ChevronDown, Mail, Server } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'react-hot-toast';
import { clientFetch } from '@/lib/client-fetch';

type Props = {
  campaign: {
    id: string;
    name: string;
    status: string;
  };
  inboxes: Array<{
    id: string;
    email_address: string;
    operator_id?: string | null;
  }>;
  campaignInboxes: Array<{
    inbox_id: string;
  }>;
  lockedInboxes?: Array<{
    inbox_id: string;
    blocking_campaign_id: string;
    blocking_campaign_name: string;
    blocking_status: string;
  }>;
};

type BackendHealth = 'checking' | 'online' | 'offline';

export default function CampaignHeader({
  campaign,
  inboxes,
  campaignInboxes,
  lockedInboxes = []
}: Props) {

  /**
   * Inbox IDs currently attached in DB
   */
  const attachedInboxIds = useMemo(() => new Set(
    campaignInboxes.map(ci => ci.inbox_id)
  ), [campaignInboxes]);

  /**
   * Local UI state (NO side effects)
   */
  const [selected, setSelected] = useState<Set<string>>(
    new Set(attachedInboxIds)
  );
  const [saving, setSaving] = useState(false);
  const [backendHealth, setBackendHealth] = useState<BackendHealth>('checking');
  const [isInboxesOpen, setIsInboxesOpen] = useState(true);
  const [lockConflicts, setLockConflicts] = useState<Array<{
    inbox_id: string;
    email_address: string;
    blocking_campaign_id: string;
    blocking_campaign_name: string;
    blocking_status: string;
  }>>([]);

  const lockMap = useMemo(() => {
    const map = new Map<string, {
      inbox_id: string;
      blocking_campaign_id: string;
      blocking_campaign_name: string;
      blocking_status: string;
    }>();
    for (const row of lockedInboxes) {
      if (row?.inbox_id) map.set(String(row.inbox_id), row);
    }
    return map;
  }, [lockedInboxes]);

  function toggle(inboxId: string) {
    if (lockMap.has(inboxId)) return;
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(inboxId)) next.delete(inboxId);
      else next.add(inboxId);
      return next;
    });
  }

  async function checkBackendHealth() {
    try {
      await clientFetch<{ ok: boolean }>('/ping');
      setBackendHealth('online');
    } catch {
      setBackendHealth('offline');
    }
  }

  useEffect(() => {
    void checkBackendHealth();
  }, []);

  useEffect(() => {
    const storageKey = `campaign:${campaign.id}:inboxesOpen`;
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored === '0') setIsInboxesOpen(false);
      if (stored === '1') setIsInboxesOpen(true);
    } catch {
      // Ignore localStorage read errors in restricted environments.
    }
  }, [campaign.id]);

  useEffect(() => {
    const storageKey = `campaign:${campaign.id}:inboxesOpen`;
    try {
      window.localStorage.setItem(storageKey, isInboxesOpen ? '1' : '0');
    } catch {
      // Ignore localStorage write errors in restricted environments.
    }
  }, [campaign.id, isInboxesOpen]);

  async function applyChanges() {
    if (saving) return;
    if (backendHealth !== 'online') {
      toast.error('Backend offline. Start backend and retry.');
      return;
    }

    const selectedInboxIds = [...selected];

    try {
      setSaving(true);
      setLockConflicts([]);
      const result = await updateCampaignInboxes(
        campaign.id,
        selectedInboxIds
      );
      if (!result.success) {
        if (Array.isArray(result.conflicts) && result.conflicts.length > 0) {
          setLockConflicts(result.conflicts);
          toast.error('Some inboxes are locked by other active campaigns.');
          return;
        }
        throw new Error(result.errors?.[0] ?? 'Failed to save campaign inboxes');
      }
      toast.success(
        `Saved inboxes. Attached: ${result.attached}, removed: ${result.detached}, unchanged: ${result.unchanged}.`
      );
      setBackendHealth('online');
    } catch (error) {
      const raw = error instanceof Error ? error.message : 'Unknown error';
      const lower = raw.toLowerCase();
      if (lower.includes('backend unavailable') || lower.includes('fetch failed')) {
        setBackendHealth('offline');
        toast.error('Backend unavailable while saving inboxes. Please retry in a moment.');
      } else {
        toast.error(raw);
      }
    } finally {
      setSaving(false);
    }
  }

  const unchanged =
    JSON.stringify([...selected].sort()) ===
    JSON.stringify([...attachedInboxIds].sort());

  const canStart =
    campaign.status === 'draft' || campaign.status === 'paused';
  const canPause = campaign.status === 'running';

  // Sort inboxes: unlocked first, then selected, then by email
  const sortedInboxes = [...inboxes].sort((a, b) => {
    const aLocked = lockMap.has(String(a.id));
    const bLocked = lockMap.has(String(b.id));
    if (aLocked !== bLocked) return aLocked ? 1 : -1;

    const aSelected = selected.has(a.id);
    const bSelected = selected.has(b.id);
    if (aSelected && !bSelected) return -1;
    if (!aSelected && bSelected) return 1;
    return a.email_address.localeCompare(b.email_address);
  });

  return (
    <div className="border border-border/50 rounded-2xl p-6 space-y-8 bg-card/40 backdrop-blur-sm shadow-sm">

      {/* Campaign Info */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-3">
            {campaign.name}
            <span className={cn(
              "px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider",
              campaign.status === 'draft' ? "bg-muted text-muted-foreground" :
              campaign.status === 'running' ? "bg-green-500/20 text-green-400 border border-green-500/30" :
              "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
            )}>
              {campaign.status}
            </span>
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage the sending infrastructure assigned to this campaign.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            {(canStart || canPause) && (
              <form action={canStart ? startCampaignAction.bind(null, campaign.id) : pauseCampaignAction.bind(null, campaign.id)}>
                <Button variant={canPause ? 'destructive' : 'default'} type="submit">
                  {canStart ? 'Start Campaign' : 'Pause Campaign'}
                </Button>
              </form>
            )}
            <Button
              onClick={applyChanges}
              disabled={unchanged || saving || backendHealth !== 'online'}
              className="transition-all"
            >
              {saving ? 'Saving...' : 'Save Configuration'}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'text-xs px-2 py-1 rounded-md border',
                backendHealth === 'online' && 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
                backendHealth === 'offline' && 'text-rose-400 border-rose-500/30 bg-rose-500/10',
                backendHealth === 'checking' && 'text-amber-300 border-amber-400/30 bg-amber-500/10'
              )}
            >
              {backendHealth === 'online' && 'Backend online'}
              {backendHealth === 'offline' && 'Backend offline'}
              {backendHealth === 'checking' && 'Checking backend...'}
            </span>
            {backendHealth !== 'online' && (
              <Button size="sm" variant="outline" onClick={() => void checkBackendHealth()}>
                Retry
              </Button>
            )}
          </div>
          {canStart && selected.size === 0 && (
            <span className="text-xs font-medium text-red-500 bg-red-500/10 px-2 py-1 rounded-md">
              At least one inbox required
            </span>
          )}
        </div>
      </div>

      {/* Inbox Selection Grid */}
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setIsInboxesOpen((prev) => !prev)}
          className="w-full flex items-center justify-between rounded-lg border border-border/70 bg-background/40 px-3 py-2 text-left hover:bg-accent/30 transition-colors"
          aria-expanded={isInboxesOpen}
          aria-label={isInboxesOpen ? 'Collapse sending inboxes' : 'Expand sending inboxes'}
        >
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
            <Server className="w-4 h-4 text-muted-foreground" />
            Sending Inboxes
            <span className="ml-2 bg-primary/10 text-primary px-2 py-0.5 rounded-full text-xs">
              {selected.size} / {inboxes.length} Selected
            </span>
          </h3>
          <ChevronDown
            className={cn(
              'w-4 h-4 text-muted-foreground transition-transform duration-200',
              isInboxesOpen ? 'rotate-180' : 'rotate-0'
            )}
          />
        </button>

        {isInboxesOpen && (
          inboxes.length === 0 ? (
            <div className="py-12 border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center text-muted-foreground">
              <Mail className="w-8 h-8 mb-3 opacity-50" />
              <p className="text-sm font-medium">No inboxes available</p>
              <p className="text-xs">Connect an inbox in the email automation settings.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {sortedInboxes.map(inbox => {
                const isSelected = selected.has(inbox.id);
                const lockInfo = lockMap.get(String(inbox.id));
                const isLocked = Boolean(lockInfo);
                return (
                  <div
                    key={inbox.id}
                    onClick={() => toggle(inbox.id)}
                    className={cn(
                      "group relative flex flex-col gap-3 p-4 rounded-xl border transition-all duration-200 cursor-pointer overflow-hidden",
                      isLocked && "opacity-70 cursor-not-allowed",
                      isSelected
                        ? "border-primary bg-primary/5 shadow-[0_0_15px_rgba(var(--primary),0.15)]"
                        : "border-border bg-background hover:border-primary/50 hover:bg-accent/50 hover:shadow-md"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3 relative z-10">
                      <div className={cn(
                        "flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-md border transition-colors mt-0.5",
                        isSelected
                          ? "bg-primary border-primary text-primary-foreground"
                          : "border-muted-foreground/40 bg-background group-hover:border-primary/50"
                      )}>
                        {isSelected && <Check className="w-3.5 h-3.5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "text-sm font-medium truncate transition-colors",
                          isSelected ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
                        )} title={inbox.email_address}>
                          {inbox.email_address}
                        </p>
                        {isLocked ? (
                          <p className="mt-1 text-[11px] text-amber-300">
                            Locked by: {lockInfo?.blocking_campaign_name} ({lockInfo?.blocking_status})
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pl-8 relative z-10">
                      {inbox.operator_id == null && (
                        <span className="px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-semibold tracking-widest uppercase">
                          Public
                        </span>
                      )}
                      {isLocked && (
                        <span className="px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] font-semibold tracking-widest uppercase">
                          Locked
                        </span>
                      )}
                    </div>

                    {isSelected && (
                      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-50 z-0 pointer-events-none" />
                    )}
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>

      {lockConflicts.length > 0 ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
          <p className="font-semibold">Inbox lock conflicts</p>
          <div className="mt-2 space-y-1">
            {lockConflicts.map((row, idx) => (
              <p key={`${row.inbox_id}-${idx}`}>
                {row.email_address} is locked by {row.blocking_campaign_name} ({row.blocking_status}).
              </p>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
