'use client';

import { Button } from '@/components/ui/button';
import {
  startCampaignAction,
  pauseCampaignAction,
} from './actions';

export default function CampaignControls({ campaign }: any) {
  const startCampaign = async () => {
    await startCampaignAction(campaign.id);
  };
  const pauseCampaign = async () => {
    await pauseCampaignAction(campaign.id);
  };

  return (
    <div className="flex gap-4">
      {(campaign.status === 'draft' ||
        campaign.status === 'paused') && (
        <form
          action={startCampaign}
        >
          <Button>Start Campaign</Button>
        </form>
      )}

      {campaign.status === 'running' && (
        <form
          action={pauseCampaign}
        >
          <Button variant="destructive">
            Pause Campaign
          </Button>
        </form>
      )}
    </div>
  );
}
