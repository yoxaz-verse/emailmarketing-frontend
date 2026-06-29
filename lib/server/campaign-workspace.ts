import { cache } from 'react';
import { serverFetch } from './server-fetch';

export type CampaignWorkspace = {
  campaign: any;
  assigned_operator_name: string | null;
  inboxes: any[];
  campaign_inboxes: any[];
  locked_inboxes: any[];
  sending_domains: any[];
  sequence: any | null;
  sequence_steps: any[];
  lead_folders: Array<{ id: string; name: string; operator_id?: string | null }>;
  sending_limits: any | null;
  sender_settings: {
    sender_display_name: string | null;
    effective_sender_display_name: string;
    warning: string | null;
    schema_ready?: boolean;
  };
  mutation_health: {
    ok: boolean;
    reason?: string;
    routeContractVersion?: string;
  };
};

export const getCampaignWorkspace = cache((campaignId: string) =>
  serverFetch<CampaignWorkspace>(`/campaigns/${encodeURIComponent(campaignId)}/workspace`)
);
