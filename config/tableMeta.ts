export type BadgeConfig = {
    type: 'boolean';
    field: string;
    truthyLabel: string;
    falsyLabel: string;
  };
  
  export type ActionConfig = {
    key: string;
    label: string;
    variant?: 'default' | 'outline' | 'destructive';
    visible?: (row: any) => boolean;
  };
  
  export type TableMeta = {
    allowCreate?: boolean;
    allowEdit?: boolean;
    allowDelete?: boolean;
  
    badge?: BadgeConfig;
    actions?: ActionConfig[];
  };
  
  export const tableMeta: Record<string, TableMeta> = {
    sequences: {
      allowCreate: true,
      allowEdit: false,
      allowDelete: false,
  
 
  
      actions: [
        {
          key: 'viewSequence',
          label: 'View',
          variant: 'outline',
        },
        {
          key: 'enableSequence',
          label: 'Enable',
          visible: (row) => !row.is_active,
        },
        {
          key: 'disableSequence',
          label: 'Disable',
          variant: 'outline',
          visible: (row) => row.is_active,
        },
      ],
    },
    campaign_inboxes: {
      allowCreate: true,
      allowEdit: true,
      allowDelete: true,
    },  
    campaigns: {
      allowCreate: true,
      allowEdit: true,
      allowDelete: false,
  
      actions: [
        {
          key: 'viewCampaign',
          label: 'View',
          variant: 'outline',
        },  {
          key: 'startCampaign',
          label: 'Start',
          visible: (row: any) =>
            row.status === 'draft' || row.status === 'paused',
        },
        {
          key: 'pauseCampaign',
          label: 'Pause',
          variant: 'destructive',
          visible: (row: any) =>
            row.status === 'running',
        },
      ],
    },
    smtp_accounts: {
      allowCreate: true,
      allowEdit: true,
      allowDelete: false,
  
      actions: [
        {
          key: 'validateSmtpAccount',
          label: 'Validate',
          variant: 'outline',
        },  
      ],
    },
    sending_domains: {
      allowCreate: true,
      allowEdit: true,
      allowDelete: false,
  
      actions: [
        {
          key: 'validateSendingDomain',
          label: 'Validate',
          variant: 'outline',
        },  
      ],
    },
    campaign_leads: {
      allowCreate: false,
      allowEdit: false,
      allowDelete: false,
  
   
    },
    
  };
  