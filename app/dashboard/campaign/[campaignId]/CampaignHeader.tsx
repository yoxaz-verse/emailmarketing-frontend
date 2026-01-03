'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { updateCampaignInboxes } from './actions';

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
  const attachedInboxIds = new Set(
    campaignInboxes.map(ci => ci.inbox_id)
  );

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

  const attachedInboxes = inboxes.filter(i =>
    attachedInboxIds.has(i.id)
  );

  const availableInboxes = inboxes.filter(i =>
    !attachedInboxIds.has(i.id)
  );

  const unchanged =
    JSON.stringify([...selected].sort()) ===
    JSON.stringify([...attachedInboxIds].sort());

  const canStart =
    campaign.status === 'draft' || campaign.status === 'paused';

  return (
    <div className="border rounded-md p-4 space-y-6 bg-white">

      {/* Campaign Info */}
      <div>
        <div className="text-lg font-semibold">
          {campaign.name}
        </div>
        <div className="text-xs text-muted-foreground">
          Status: {campaign.status}
        </div>
      </div>

      {/* Attached Inboxes */}
      <div className="space-y-2">
        <div className="text-sm font-medium">
          Campaign Inboxes ({attachedInboxes.length})
        </div>

        {attachedInboxes.length === 0 && (
          <div className="text-xs text-muted-foreground">
            No inboxes attached
          </div>
        )}

        {attachedInboxes.map(inbox => (
          <label
            key={inbox.id}
            className="flex items-center gap-2 text-sm"
          >
            <input
              type="checkbox"
              checked={selected.has(inbox.id)}
              onChange={() => toggle(inbox.id)}
            />
            <span>{inbox.email_address}</span>
          </label>
        ))}
      </div>

      {/* Available Inboxes */}
      <div className="space-y-2 border-t pt-4">
        <div className="text-sm font-medium">
          Available Inboxes ({availableInboxes.length})
        </div>

        {availableInboxes.length === 0 && (
          <div className="text-xs text-muted-foreground">
            No available inboxes
          </div>
        )}

        {availableInboxes.map(inbox => (
          <label
            key={inbox.id}
            className="flex items-center gap-2 text-sm"
          >
            <input
              type="checkbox"
              checked={selected.has(inbox.id)}
              onChange={() => toggle(inbox.id)}
            />
            <span className="flex items-center gap-2">
              {inbox.email_address}

              {inbox.operator_id == null && (
                <span className="text-xs text-blue-600">
                  Public
                </span>
              )}
            </span>
          </label>
        ))}
      </div>

      {/* Action */}
      <div className="flex justify-end border-t pt-4">
        <Button
          onClick={applyChanges}
          disabled={unchanged}
        >
          Update Campaign Inboxes
        </Button>
      </div>

      {/* Start Warning */}
      {canStart && selected.size === 0 && (
        <div className="text-xs text-red-600">
          Campaign cannot start without at least one inbox
        </div>
      )}
    </div>
  );
}
