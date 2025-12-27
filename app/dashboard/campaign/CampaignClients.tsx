'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  createCampaignAction,
  attachLeadsAction,
  startCampaignAction,
  pauseCampaignAction
} from './actions';

export default function CampaignClient({
  role,
  campaigns,
  sequences,
  leads
}: any) {
  const [campaignName, setCampaignName] = useState('');
  const [sequenceId, setSequenceId] = useState('');
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);

  return (
    <div className="space-y-6">

      <h2 className="text-xl font-semibold">Campaigns</h2>

      {/* CREATE CAMPAIGN */}
      <form action={createCampaignAction} className="space-y-2">
        <input
          name="name"
          placeholder="Campaign name"
          className="border p-2 w-full"
          value={campaignName}
          onChange={e => setCampaignName(e.target.value)}
        />

        <select
          name="sequence_id"
          className="border p-2 w-full"
          value={sequenceId}
          onChange={e => setSequenceId(e.target.value)}
        >
          <option value="">Select sequence</option>
          {sequences.map((s: any) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        <Button disabled={!campaignName || !sequenceId}>
          Create Campaign
        </Button>
      </form>

      {/* LEAD SELECTION */}
      <div className="border p-4 rounded">
        <h3 className="font-medium">Select Leads</h3>

        <div className="max-h-64 overflow-y-auto space-y-1">
          {leads.map((l: any) => (
            <label key={l.id} className="flex gap-2">
              <input
                type="checkbox"
                value={l.id}
                onChange={(e) => {
                  setSelectedLeads(prev =>
                    e.target.checked
                      ? [...prev, l.id]
                      : prev.filter(id => id !== l.id)
                  );
                }}
              />
              {l.email}
            </label>
          ))}
        </div>

        <form action={attachLeadsAction}>
          <input
            type="hidden"
            name="lead_ids"
            value={JSON.stringify(selectedLeads)}
          />
          <Button disabled={selectedLeads.length === 0}>
            Attach Leads to Campaign
          </Button>
        </form>
      </div>

      {/* CAMPAIGN LIST */}
      <div className="space-y-2">
        {campaigns.map((c: any) => (
          <div key={c.id} className="border p-3 rounded flex justify-between">
            <div>
              <b>{c.name}</b>
              <div className="text-sm">Status: {c.status}</div>
            </div>

            {c.status === 'running' ? (
              <form action={pauseCampaignAction}>
                <input type="hidden" name="campaign_id" value={c.id} />
                <Button variant="destructive">Pause</Button>
              </form>
            ) : (
              <form action={startCampaignAction}>
                <input type="hidden" name="campaign_id" value={c.id} />
                <Button>Start</Button>
              </form>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
