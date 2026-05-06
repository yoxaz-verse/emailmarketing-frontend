'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { updateCampaignInboxes } from './actions';
import { Check, Mail, Server } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
  campaign: any;
  inboxes: any[];           // all allowed inboxes
  campaignInboxes: any[];   // rows from campaign_inboxes (with id)
};

export default function CampaignHeader({
  campaign,
  inboxes,
  campaignInboxes
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

  function toggle(inboxId: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(inboxId) ? next.delete(inboxId) : next.add(inboxId);
      return next;
    });
  }

  async function applyChanges() {
    const toAttach = [...selected].filter(
      id => !attachedInboxIds.has(id)
    );

    const toDetach = campaignInboxes
      .filter(ci => !selected.has(ci.inbox_id))
      .map(ci => ci.id);

    await updateCampaignInboxes(
      campaign.id,
      toAttach,
      toDetach
    );
  }

  const unchanged =
    JSON.stringify([...selected].sort()) ===
    JSON.stringify([...attachedInboxIds].sort());

  const canStart =
    campaign.status === 'draft' || campaign.status === 'paused';

  // Sort inboxes: selected first, then by email
  const sortedInboxes = [...inboxes].sort((a, b) => {
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
          <Button
            onClick={applyChanges}
            disabled={unchanged}
            className="transition-all"
          >
            Save Configuration
          </Button>
          {canStart && selected.size === 0 && (
            <span className="text-xs font-medium text-red-500 bg-red-500/10 px-2 py-1 rounded-md">
              At least one inbox required
            </span>
          )}
        </div>
      </div>

      {/* Inbox Selection Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
            <Server className="w-4 h-4 text-muted-foreground" />
            Sending Inboxes
            <span className="ml-2 bg-primary/10 text-primary px-2 py-0.5 rounded-full text-xs">
              {selected.size} / {inboxes.length} Selected
            </span>
          </h3>
        </div>

        {inboxes.length === 0 ? (
          <div className="py-12 border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center text-muted-foreground">
            <Mail className="w-8 h-8 mb-3 opacity-50" />
            <p className="text-sm font-medium">No inboxes available</p>
            <p className="text-xs">Connect an inbox in the email automation settings.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {sortedInboxes.map(inbox => {
              const isSelected = selected.has(inbox.id);
              return (
                <div
                  key={inbox.id}
                  onClick={() => toggle(inbox.id)}
                  className={cn(
                    "group relative flex flex-col gap-3 p-4 rounded-xl border transition-all duration-200 cursor-pointer overflow-hidden",
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
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 pl-8 relative z-10">
                    {inbox.operator_id == null && (
                      <span className="px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-semibold tracking-widest uppercase">
                        Public
                      </span>
                    )}
                  </div>
                  
                  {/* Active highlight accent */}
                  {isSelected && (
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-50 z-0 pointer-events-none" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
