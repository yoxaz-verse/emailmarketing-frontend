'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { attachLeadsAction } from './actions';

type Lead = {
  id: string;
  email: string;
  is_used?: boolean;
  is_blocked?: boolean;
};

export default function LeadsTab({
  campaign,
  leads,
  campaignLeads,
}: {
  campaign: any;
  leads: Lead[];
  campaignLeads: { lead_id: string }[];
}) {
  /**
   * Leads already attached to this campaign
   */
  const attachedLeadIds = new Set(
    campaignLeads.map((cl) => cl.lead_id)
  );

  /**
   * ✅ Only FREE-TO-USE leads
   * - not used in any campaign
   * - not blocked
   */
  const freeLeads = leads.filter((lead) => {
    return (
      lead.is_used !== true &&
      lead.is_blocked !== true
    );
  });

  const invalidLeads = leads.filter((lead) => {
    return (
      lead.is_used === true ||
      lead.is_blocked === true
    );
  });

  /**
   * Local selection state (UI intent)
   * Default: already attached leads
   */
  const [selected, setSelected] = useState<Set<string>>(
    new Set(attachedLeadIds)
  );

  /**
   * Toggle checkbox
   */
  function toggle(leadId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(leadId) ? next.delete(leadId) : next.add(leadId);
      return next;
    });
  }

  /**
   * Select all FREE leads
   */
  function selectAll() {
    setSelected(new Set(freeLeads.map((l) => l.id)));
  }

  /**
   * Clear selection
   */
  function clearAll() {
    setSelected(new Set());
  }

  /**
   * Submit only selected IDs
   */
  async function submit() {
    await attachLeadsAction(
      campaign.id,
      Array.from(selected)
    );
  }

  return (
    <div className="border border-border rounded p-4 space-y-4 bg-card">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">
          Campaign Leads
        </h2>

        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={selectAll}
            disabled={freeLeads.length === 0}
          >
            Select all
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={clearAll}
          >
            Clear
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>Valid: {freeLeads.length}</span>
        <span>Invalid: {invalidLeads.length}</span>
      </div>

      {/* Lead list (FREE ONLY) */}
      <div className="space-y-2 max-h-[420px] overflow-auto border border-border rounded p-2 bg-background">
        {freeLeads.length === 0 && (
          <div className="text-sm text-muted-foreground text-center py-6">
            No free leads available
          </div>
        )}

        {freeLeads.map((lead) => {
          const isAttached = attachedLeadIds.has(lead.id);
          const isSelected = selected.has(lead.id);

          return (
            <label
              key={lead.id}
              className={`flex items-center gap-2 text-sm p-1 rounded cursor-pointer ${
                isAttached
                  ? 'bg-emerald-500/10'
                  : isSelected
                  ? 'bg-blue-500/10'
                  : ''
              }`}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggle(lead.id)}
              />

              <span className="flex-1">
                {lead.email}
              </span>

              {isAttached && (
                <span className="text-xs text-emerald-300">
                  Attached
                </span>
              )}
            </label>
          );
        })}
      </div>

      {invalidLeads.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Invalid Leads</h3>
          <div className="space-y-2 max-h-[240px] overflow-auto border border-border rounded p-2 bg-background">
            {invalidLeads.map((lead) => {
              const status = lead.is_blocked
                ? 'Blocked'
                : lead.is_used
                ? 'Used'
                : 'Invalid';
              return (
                <div
                  key={lead.id}
                  className="flex items-center gap-2 text-sm p-1 rounded bg-muted/30"
                >
                  <span className="flex-1 text-muted-foreground">
                    {lead.email}
                  </span>
                  <span className="text-xs rounded-full border border-border px-2 py-0.5 text-muted-foreground">
                    {status}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Action */}
      <div className="flex justify-end">
        <form action={submit}>
          <Button disabled={selected.size === 0}>
            Update Campaign Leads
          </Button>
        </form>
      </div>
    </div>
  );
}
