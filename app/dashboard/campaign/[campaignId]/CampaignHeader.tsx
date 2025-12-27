'use client';

import { Button } from '@/components/ui/button';
import {
  startCampaignAction,
  pauseCampaignAction,
} from './actions';

export default function CampaignHeader({
  campaign,
}: {
  campaign: any;
}) {
  return (
    <div className="border rounded p-4 flex justify-between items-center">
      <div>
        <h1 className="text-xl font-semibold">
          {campaign.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          Status: {campaign.status}
        </p>
      </div>

      {campaign.status === 'running' ? (
        <form action={() => pauseCampaignAction(campaign.id)}>
          <Button variant="destructive">Pause</Button>
        </form>
      ) : (
        <form action={() => startCampaignAction(campaign.id)}>
          <Button>Start</Button>
        </form>
      )}
    </div>
  );
}
