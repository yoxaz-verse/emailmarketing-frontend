'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { attachLeadsAction } from './actions';

type Lead = {
  id: string;
  email: string;
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
   * Local selection state (UI intent)
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
   * Select all
   */
  function selectAll() {
    setSelected(new Set(leads.map((l) => l.id)));
  }

  /**
   * Clear selection
   */
  function clearAll() {
    setSelected(new Set());
  }

  /**
   * Only send IDs (array)
   */
  async function submit() {
    await attachLeadsAction(campaign.id, Array.from(selected));
  }

  return (
    <div className="border rounded p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Campaign Leads</h2>

        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={selectAll}>
            Select all
          </Button>
          <Button size="sm" variant="outline" onClick={clearAll}>
            Clear
          </Button>
        </div>
      </div>

      {/* Lead list */}
      <div className="space-y-2 max-h-[420px] overflow-auto border rounded p-2">
        {leads.map((lead) => {
          const isAttached = attachedLeadIds.has(lead.id);
          const isSelected = selected.has(lead.id);

          return (
            <label
              key={lead.id}
              className={`flex items-center gap-2 text-sm p-1 rounded cursor-pointer ${
                isAttached
                  ? 'bg-green-50'
                  : isSelected
                  ? 'bg-blue-50'
                  : ''
              }`}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggle(lead.id)}
              />

              <span className="flex-1">{lead.email}</span>

              {isAttached && (
                <span className="text-xs text-green-700">
                  Attached
                </span>
              )}
            </label>
          );
        })}
      </div>

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
