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
  personalization: CampaignPersonalizationState;
  mutation_health: {
    ok: boolean;
    reason?: string;
    routeContractVersion?: string;
  };
};

export type CampaignMergeMapping = {
  placeholder_key: string;
  placeholder_label: string;
  source_type: 'lead_field' | 'fixed_text';
  lead_field: string | null;
  fixed_value: string | null;
  required: boolean;
  reviewed_signature?: string | null;
};

export type CampaignPersonalizationState = {
  placeholders: Array<{
    key: string;
    label: string;
    usages: Array<{ step_number: number; location: 'subject' | 'body' }>;
    suggested_lead_field: string | null;
  }>;
  mappings: CampaignMergeMapping[];
  signature: string;
  reviewed_signature: string | null;
  reviewed: boolean;
  stale: boolean;
  errors: string[];
  allowed_lead_fields: string[];
  missing_lead_count: number;
  missing_leads: Array<{ campaign_lead_id: string; lead_id: string; email: string | null; missing: string[] }>;
  sample_lead: Record<string, unknown> | null;
};

export const getCampaignWorkspace = cache((campaignId: string) =>
  serverFetch<CampaignWorkspace>(`/campaigns/${encodeURIComponent(campaignId)}/workspace`)
);
