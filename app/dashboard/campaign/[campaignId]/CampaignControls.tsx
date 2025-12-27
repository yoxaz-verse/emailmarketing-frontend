'use client';

import { Button } from '@/components/ui/button';
import {
  startCampaignAction,
  pauseCampaignAction,
} from './actions';

export default function CampaignControls({ campaign }: any) {
  return (
    <div className="flex gap-4">
      {(campaign.status === 'draft' ||
        campaign.status === 'paused') && (
        <form
          action={startCampaignAction.bind(null, campaign.id)}
        >
          <Button>Start Campaign</Button>
        </form>
      )}

      {campaign.status === 'running' && (
        <form
          action={pauseCampaignAction.bind(null, campaign.id)}
        >
          <Button variant="destructive">
            Pause Campaign
          </Button>
        </form>
      )}
    </div>
  );
}
