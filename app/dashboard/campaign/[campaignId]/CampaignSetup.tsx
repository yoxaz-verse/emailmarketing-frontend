'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Mail, Server, Settings2, UserRound } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { updateCampaignInboxes, updateCampaignSenderSettings } from './actions';

type CampaignSetupProps = {
  campaign: { id: string; status: string; operator_id?: string | null };
  assignedOperatorName: string | null;
  sequence: { id?: string; name?: string | null } | null;
  sequenceStepCount: number;
  senderSettings: {
    sender_display_name: string | null;
    effective_sender_display_name: string;
    warning: string | null;
    schema_ready?: boolean;
  };
  inboxes: Array<{ id: string; email_address: string; operator_id?: string | null }>;
  campaignInboxes: Array<{ inbox_id: string }>;
  lockedInboxes?: Array<{
    inbox_id: string;
    blocking_campaign_id: string;
    blocking_campaign_name: string;
    blocking_status: string;
  }>;
};

export default function CampaignSetup({
  campaign,
  assignedOperatorName,
  sequence,
  sequenceStepCount,
  senderSettings,
  inboxes,
  campaignInboxes,
  lockedInboxes = [],
}: CampaignSetupProps) {
  const router = useRouter();
  const attachedInboxIds = useMemo(
    () => new Set(campaignInboxes.map((row) => String(row.inbox_id))),
    [campaignInboxes]
  );
  const [selected, setSelected] = useState<Set<string>>(new Set(attachedInboxIds));
  const [savingInboxes, setSavingInboxes] = useState(false);
  const [senderDisplayName, setSenderDisplayName] = useState(senderSettings.sender_display_name ?? '');
  const [savingSender, setSavingSender] = useState(false);
  const [senderWarning, setSenderWarning] = useState(senderSettings.warning);
  const [lockConflicts, setLockConflicts] = useState<Array<{
    inbox_id: string;
    email_address: string;
    blocking_campaign_id: string;
    blocking_campaign_name: string;
    blocking_status: string;
  }>>([]);

  useEffect(() => setSelected(new Set(attachedInboxIds)), [attachedInboxIds]);
  useEffect(() => setSenderDisplayName(senderSettings.sender_display_name ?? ''), [senderSettings.sender_display_name]);

  const lockMap = useMemo(() => new Map(lockedInboxes.map((row) => [String(row.inbox_id), row])), [lockedInboxes]);
  const sortedInboxes = useMemo(() => [...inboxes].sort((a, b) => {
    const aLocked = lockMap.has(String(a.id));
    const bLocked = lockMap.has(String(b.id));
    if (aLocked !== bLocked) return aLocked ? 1 : -1;
    const aSelected = selected.has(String(a.id));
    const bSelected = selected.has(String(b.id));
    if (aSelected !== bSelected) return aSelected ? -1 : 1;
    return a.email_address.localeCompare(b.email_address);
  }), [inboxes, lockMap, selected]);

  const unchanged = JSON.stringify([...selected].sort()) === JSON.stringify([...attachedInboxIds].sort());
  const locked = String(campaign.status).toLowerCase() === 'running';
  const operatorLabel = assignedOperatorName
    ?? (String(campaign.operator_id ?? '').trim() ? 'Unknown operator' : 'Not assigned');

  function toggleInbox(inboxId: string) {
    if (locked || lockMap.has(inboxId)) return;
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(inboxId)) next.delete(inboxId);
      else next.add(inboxId);
      return next;
    });
  }

  async function saveInboxes() {
    if (savingInboxes || locked) return;
    try {
      setSavingInboxes(true);
      setLockConflicts([]);
      const result = await updateCampaignInboxes(campaign.id, [...selected]);
      if (!result.success) {
        if (result.conflicts?.length) setLockConflicts(result.conflicts);
        throw new Error(result.errors?.[0] ?? 'Failed to save sending inboxes');
      }
      toast.success(`Saved inboxes: ${result.attached} attached, ${result.detached} removed.`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save sending inboxes');
    } finally {
      setSavingInboxes(false);
    }
  }

  async function saveSender() {
    if (savingSender) return;
    try {
      setSavingSender(true);
      const result = await updateCampaignSenderSettings(campaign.id, senderDisplayName);
      if (!result.success) throw new Error(result.error || 'Failed to save sender name');
      setSenderWarning(result.warning ?? null);
      toast.success('Campaign sender name updated.');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save sender name');
    } finally {
      setSavingSender(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-card/50 p-5">
        <div className="flex items-center gap-2">
          <Settings2 className="size-4 text-primary" aria-hidden="true" />
          <h2 className="font-semibold">Campaign details</h2>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-[1.5fr_1fr_1fr]">
          <div className="rounded-lg border border-border/70 p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Sender identity</div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                value={senderDisplayName}
                onChange={(event) => setSenderDisplayName(event.target.value)}
                placeholder="OBAOL Team"
                className="h-9 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-sm"
                disabled={senderSettings.schema_ready === false}
              />
              <Button variant="outline" onClick={() => void saveSender()} disabled={savingSender || senderSettings.schema_ready === false}>
                {savingSender ? 'Saving…' : 'Save sender'}
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Effective sender: <span className="text-foreground">{senderDisplayName.trim() || 'OBAOL Team'}</span></p>
            {senderSettings.schema_ready === false ? <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">Apply the sender settings schema update to enable this field.</p> : null}
            {senderWarning ? <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">{senderWarning}</p> : null}
          </div>
          <div className="rounded-lg border border-border/70 p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground"><UserRound className="size-4" />Assigned operator</div>
            <div className="mt-3 font-medium">{operatorLabel}</div>
          </div>
          <div className="rounded-lg border border-border/70 p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Sequence</div>
            <div className="mt-3 font-medium">{sequence?.name || 'No sequence assigned'}</div>
            <div className="mt-1 text-xs text-muted-foreground">{sequenceStepCount} configured step{sequenceStepCount === 1 ? '' : 's'}</div>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card/50 p-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2"><Server className="size-4 text-primary" /><h2 className="font-semibold">Sending inboxes</h2></div>
            <p className="mt-1 text-xs text-muted-foreground">{selected.size} selected from {inboxes.length} available inboxes.</p>
          </div>
          <Button onClick={() => void saveInboxes()} disabled={unchanged || savingInboxes || locked}>
            {savingInboxes ? 'Saving…' : 'Save configuration'}
          </Button>
        </div>
        {locked ? <div className="mt-4 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-300">Pause the campaign before changing sending inboxes.</div> : null}
        {inboxes.length === 0 ? (
          <div className="mt-4 flex min-h-36 flex-col items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground">
            <Mail className="mb-2 size-7 opacity-60" /><p className="text-sm">No campaign inboxes are available.</p>
          </div>
        ) : (
          <div className="mt-4 grid max-h-[420px] gap-3 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
            {sortedInboxes.map((inbox) => {
              const inboxId = String(inbox.id);
              const isSelected = selected.has(inboxId);
              const lockInfo = lockMap.get(inboxId);
              return (
                <button
                  key={inboxId}
                  type="button"
                  onClick={() => toggleInbox(inboxId)}
                  disabled={locked || Boolean(lockInfo)}
                  className={cn(
                    'rounded-xl border p-4 text-left transition-colors',
                    isSelected ? 'border-primary bg-primary/5' : 'border-border bg-background/40 hover:border-primary/50',
                    lockInfo && 'cursor-not-allowed opacity-60'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span className={cn('mt-0.5 flex size-5 items-center justify-center rounded border', isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40')}>
                      {isSelected ? <Check className="size-3.5" /> : null}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium" title={inbox.email_address}>{inbox.email_address}</div>
                      <div className="mt-1 flex flex-wrap gap-1 text-[10px] uppercase tracking-wider">
                        {inbox.operator_id == null ? <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">Public</span> : null}
                        {lockInfo ? <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-amber-700 dark:text-amber-300">Locked · {lockInfo.blocking_campaign_name}</span> : null}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
        {lockConflicts.length ? (
          <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-300">
            {lockConflicts.map((row) => <p key={row.inbox_id}>{row.email_address} is locked by {row.blocking_campaign_name}.</p>)}
          </div>
        ) : null}
      </section>
    </div>
  );
}
