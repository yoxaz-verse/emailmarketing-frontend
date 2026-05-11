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

export type BulkActionConfig = {
  key: 'bulkDelete';
  label: string;
  confirmText?: string;
  variant?: 'default' | 'outline' | 'destructive';
};
  
  export type TableMeta = {
    allowCreate?: boolean;
    allowEdit?: boolean;
    allowDelete?: boolean;
  
  badge?: BadgeConfig;
  actions?: ActionConfig[];
  bulkActions?: BulkActionConfig[];
  };
  
  export const tableMeta: Record<string, TableMeta> = {
    sequences: {
      allowCreate: true,
      allowEdit: false,
      allowDelete: true,
  
 
  
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
      allowDelete: true,
  
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
      bulkActions: [
        {
          key: 'bulkDelete',
          label: 'Remove Selected From Campaign',
          confirmText: 'Remove selected rows from this campaign? This will not delete master leads.',
          variant: 'destructive',
        },
      ],
    },
    newsletter_subscribers: {
      allowCreate: true,
      allowEdit: true,
      allowDelete: false,
    },
    newsletter_preferences: {
      allowCreate: true,
      allowEdit: true,
      allowDelete: true,
    },
    newsletter_issues: {
      allowCreate: true,
      allowEdit: true,
      allowDelete: false,
      actions: [
        {
          key: 'publishNewsletterIssue',
          label: 'Publish',
          visible: (row: any) => row.status === 'draft' || row.status === 'scheduled',
        },
        {
          key: 'runNewsletterIssueNow',
          label: 'Run Now',
          variant: 'outline',
          visible: (row: any) => row.status === 'draft' || row.status === 'scheduled' || row.status === 'published',
        },
        {
          key: 'pauseNewsletterIssue',
          label: 'Pause',
          variant: 'destructive',
          visible: (row: any) => row.status === 'scheduled' || row.status === 'published',
        },
        {
          key: 'resumeNewsletterIssue',
          label: 'Resume',
          variant: 'outline',
          visible: (row: any) => row.status === 'paused' && row.recurring_enabled === true,
        },
      ],
    },
    newsletter_send_jobs: {
      allowCreate: false,
      allowEdit: false,
      allowDelete: false,
    },
    newsletter_send_logs: {
      allowCreate: false,
      allowEdit: false,
      allowDelete: false,
    },
    
  };
  
