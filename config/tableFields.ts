// config/tableConfig.ts
export type FieldType =
  | "text"
  | "email"
  | "password"
  | "number"
  | "select"
  | "boolean"  
  | "moduleAccess"
  | 'relation'
  |"adminOnly"
  | "date"
  | "dateTime"
  | "textarea"
  | "action";

  export type BadgeMeta = {
    type: 'boolean';
    truthyLabel: string;
    falsyLabel: string;
  };

  
export type TableField = {
  label: string;
  key: string;
  type: FieldType;
  placeholder?: string;
  description?: string;

  inForm: boolean;
  inTable: boolean;
  inEdit?: boolean;
  badge?: BadgeMeta; // 👈 moved HERE
 // for relation
 relation?: {
  table: string;
  labelKey: string;
  valueKey: string;

  filters?: Record<string, any>;        // static
  dynamicFilters?: string[];             // allowed keys
};


  required?: boolean;
  readOnly?: boolean;
  hidden?: boolean;
  adminOnly?: boolean;

  values?: { key: string; value: string }[];
  dynamicValuesFn?: () => Promise<{ key: string; value: string }[]>;
  dependsOn?: string;
};

export const tableConfig: Record<string, TableField[]> = {
  users: [
    {
      label: "Email",
      key: "email",
      type: "email",
      inForm: true,
      inTable: true,
      required: true,
    },
    {
      label: "Password",
      key: "password",
      type: "password",
      inForm: true,
      inTable: false,
      inEdit: false,
      required: true,
    },
    {
      label: "Role",
      key: "role",
      type: "select",
      inForm: true,
      inTable: true,
      required: true,
      values: [
        { key: "admin", value: "Admin" },
        { key: "user", value: "User" },
        { key: "viewer", value: "Viewer" },
      ],
    },{
      label: "Operator Access",
      key: "is_operator",
      type: "boolean",
      inForm: true,
      inTable: false,
      // description: "Enable operator capabilities for this user",
    }
,
    {
      label: "Module Access",
      key: "access_flags",
      type: "moduleAccess",
      inForm: true,
      inTable: false,
      description: "Choose which dashboard modules this user can access.",
    },
    
    {
      label: "Created At",
      key: "created_at",
      type: "dateTime",
      inForm: false,
      inTable: true,
      readOnly: true,
    },
  ],
  api_keys: [
    {
      label: 'Role',
      key: 'role',
      type: 'select',
      inForm: false,
      inTable: false,
      values: [
        { key: 'admin', value: 'Admin' },
        { key: 'user', value: 'User' },
        { key: 'viewer', value: 'Viewer' },
      ],
      required: true,
    },
  
    {
      label: 'User',
      key: 'user_id',
      type: 'relation',
      relation: {
        table: 'users',
        labelKey: 'email',
        valueKey: 'id',
      },
      inForm: true,
      inTable: true,
      required: true,
    },

    {
      label: 'Active',
      key: 'active',
      type: 'boolean',
      inForm: false,
      inTable: true,
    },
  
    {
      label: 'Created At',
      key: 'created_at',
      type: 'dateTime',
      inForm: false,
      inTable: true,
      readOnly: true,
    },
  
    {
      label: 'Last Used',
      key: 'last_used_at',
      type: 'dateTime',
      inForm: false,
      inTable: true,
      readOnly: true,
    },
  ],
   operators: [
    {
      label: "Name",
      key: "name",
      type: "text",
      inForm: true,
      inTable: true,
      required: true,
    },
    {
      label: "Region",
      key: "region",
      type: "text",
      inForm: true,
      inTable: true,

    },
    {
      label: "Created At",
      key: "created_at",
      type: "dateTime",
      inForm: false,
      inTable: true,
      readOnly: true,
    },
  ],

  leads: [
    {
      label: "Email",
      key: "email",
      type: "email",
      inForm: true,
      inTable: true,
      required: true,
    },
    {
      label: "First Name",
      key: "first_name",
      type: "text",
      inForm: true,
      inTable: true,

    },
    {
      label: "Last Name",
      key: "last_name",
      type: "text",
      inForm: true,
      inTable: false,
    },
    {
      label: "Company",
      key: "company",
      type: "text",
      inForm: true,
      inTable: true,

    },
    {
      label: "Country",
      key: "country",
      type: "text",
      inForm: true,
      inTable: true,
    },
    {
      label: "Source",
      key: "source",
      type: "text",
      inForm: true,
      inTable: true,
    },
    {
      label: "Risk Score",
      key: "risk_score",
      type: "number",
      inForm: false,
      inTable: true,
    },
    {
      label: "Provider",
      key: "provider",
      type: "text",
      inForm: false,
      inTable: true,
    },
    {
      label: "Disposable",
      key: "disposable",
      type: "boolean",
      inForm: false,
      inTable: true,
      badge: {
        type: "boolean",
        truthyLabel: "Yes",
        falsyLabel: "No",
      },
    },
    {
      label: "Role Based",
      key: "role_based",
      type: "boolean",
      inForm: false,
      inTable: true,
      badge: {
        type: "boolean",
        truthyLabel: "Yes",
        falsyLabel: "No",
      },
    },
    {
      label: "Free Provider",
      key: "free_provider",
      type: "boolean",
      inForm: false,
      inTable: true,
      badge: {
        type: "boolean",
        truthyLabel: "Yes",
        falsyLabel: "No",
      },
    },
    {
      key: "validation_status",
      label: "Validation Status",
      type: "text",
      inTable: true,
      inForm: false,
    },
    {
      key: 'operator_id',
      label: 'Operator',
      type: 'relation',
      relation: {
        table: 'operators',
        labelKey: 'name',
        valueKey: 'id',
      },
      inTable: true,
      inForm: true,
      adminOnly: true,
      required: true,
    },
    {
      key: 'folder_id',
      label: 'Folder',
      type: 'relation',
      relation: {
        table: 'lead_folders',
        labelKey: 'name',
        valueKey: 'id',
      },
      inTable: true,
      inForm: false,
      required: false,
    },

    {
      key: 'email_eligibility',
      label: 'Email Eligibility',
      type: 'text',
      inTable: true,
      inForm: false,
      required: true,
    },
    {
      key: 'email_eligibility_reason',
      label: 'Email Eligibility Reason',
      type: 'text',
      inTable: true,
      inForm: false,
      required: true,
    },
    {
      key: 'is_suppressed',
      label: 'Suppressed',
      type: 'boolean',
      inTable: true,
      inForm: false,
      badge: {
        type: 'boolean',
        truthyLabel: 'Yes',
        falsyLabel: 'No',
      },
    },
    {
      key: 'suppression_reason',
      label: 'Suppression Reason',
      type: 'text',
      inTable: true,
      inForm: false,
    },
    {
      label: "Created At",
      key: "created_at",
      type: "dateTime",
      inForm: false,
      inTable: false,
      readOnly: true,
    },
  ],
  sequence_analytics: [
        { label: 'Name', key: 'name', type: 'text', inTable: true, inForm:false },
        { label: 'Leads', key: 'leads_enrolled', type: 'number', inTable: true,inForm:false },
        { label: 'Completed', key: 'completed', type: 'number', inTable: true, inForm:false },
        { label: 'Stopped', key: 'stopped', type: 'number', inTable: true, inForm:false },
        {
          label: "Status",
          key: "is_active",
          type: "boolean",
          inTable: true,
          inForm: false,
          badge: {
            type: 'boolean',
            truthyLabel: "Active",
            falsyLabel: "Disabled",
          },}    ],

          sending_domains: [
            {
              key: 'domain',
              label: 'Domain',
              type: 'text',
              inTable: true,
              inForm: true,
              required: true,
            },
            {
              key: 'daily_limit',
              label: 'Daily Cap',
              type: 'number',
              inTable: true,
              inForm: false,
     },
            {
              key: 'hourly_limit',
              label: 'Hourly Cap',
              type: 'number',
              inTable: true,
              inForm: false,
     },
     {
      key: 'dkim_selector',
      label: 'DKIM Selector',
      type: 'text',
      inTable: false,
      inForm: true,
      placeholder: 'x',
      description: 'MXroute commonly uses "x" as DKIM selector.',
     },
     {
      label: "SPF",
      key: "spf_verified",
      type: "boolean",
      inTable: true,
      inForm: false,
badge: {
        type: 'boolean',
        truthyLabel: "Verified",
        falsyLabel: "No Match",
      },},  
         
     {
      label: "DKIM",
      key: "dkim_verified",
      type: "boolean",
      inTable: true,
      inForm: false,
badge: {
        type: 'boolean',
        truthyLabel: "Verified",
        falsyLabel: "No Match",
      },},  
     {
      label: "DMARC",
      key: "dmarc_verified",
      type: "boolean",
      inTable: true,
      inForm: false,
badge: {
        type: 'boolean',
        truthyLabel: "Verified",
        falsyLabel: "No Match",
      },},  
         
        
            {
              key: 'health_score',
              label: 'Health',
              type: 'number',
              inTable: true,
              inForm: false,
            },
          ],
          
          sequences: [
            {
              key: 'name',
              label: 'Sequence Name',
              type: 'text',
              inTable: true,
              inForm: true,
              required: true,
            },
            {
              label: "Valid",
              key: "is_active",
              type: "boolean",
              inTable: true,
              inForm: false,
badge: {
                type: 'boolean',
                truthyLabel: "active",
                falsyLabel: "disabled",
              },}, 
          ],
          sequence_steps: [
           
            {
              key: 'step_number',
              label: 'Step Number',
              type: 'number',
              inTable: true,
              inForm: true,
              required: true,
            },
            {
              key: 'delay_days',
              label: 'Delay Days',
              type: 'number',
              inTable: true,
              inForm: true,
              required: true,
            },
            {
              key: 'subject',
              label: 'Subject',
              type: 'text',
              inTable: true,
              inForm: true,
              required: true,
            },
            {
              key: 'body',
              label: 'Body',
              type: 'textarea',
              inTable: true,
              inForm: true,
              required: true,
            },
          ],
          smtp_accounts: [
            {
              key: 'provider',
              label: 'Provider',
              type: 'select',
              description: 'Selecting provider can auto-fill SMTP settings. MXroute uses provider TLS mapping during validation/sending.',
              inTable: true,
              inForm: true,
              required: true,
              values: [
                { key: 'mxroute', value: 'MXroute' },
                { key: 'google', value: 'Google' },
              ],
            },
            {
              key: 'host',
              label: 'SMTP Host',
              type: 'text',
              inTable: true,
              inForm: true,
              required: true,
            },
            {
              key: 'port',
              label: 'Port',
              type: 'number',
              inTable: true,
              inForm: true,
              required: true,
            },
            {
              key: 'username',
              label: 'Username',
              type: 'text',
              inTable: true,
              inForm: true,
              required: true,
              description: 'You can enter only the local part (e.g. alex). The selected sending domain will be appended automatically.',
            },

            {
              key: 'password',
              label: 'Password',
              type: 'password',
              inTable: false,
              inForm: true,
              required: true,
            },
            {
              key: 'encryption',
              label: 'Encryption',
              type: 'select',
              inTable: true,
              inForm: true,
              required: true,
              values: [
                { key: 'tls', value: 'TLS' },
                { key: 'ssl', value: 'SSL' },
              ],
            },
            {
              key: 'sending_domain_id',
              label: 'Sending Domain',
              type: 'relation',
              relation: {
                table: 'sending_domains',
                labelKey: 'domain',
                valueKey: 'id',
              },
              inTable: true,
              inForm: true,
              required: true,
            },
            {
              label: "Valid",
              key: "is_valid",
              type: "boolean",
              inTable: true,
              inForm: false,
badge: {
                type: 'boolean',
                truthyLabel: "valid",
                falsyLabel: "invalid",
              },},               
            {
              key: 'created_at',
              label: 'Created At',
              type: 'dateTime',
              inTable: true,
              inForm: false,
              readOnly: true,
            },
          ],
          
          inboxes: [
            {
              key: 'email_address',
              label: 'Email',
              type: 'text',
              inTable: true,
              inForm: true,
              required: true,
            },
            {
              key: 'purpose',
              label: 'Purpose',
              type: 'select',
              inTable: false,
              inForm: true,
              required: true,
              values: [
                { key: 'campaign', value: 'Campaign' },
                { key: 'newsletter', value: 'Newsletter' },
              ],
            },
            {
              key: 'provider',
              label: 'Provider',
              type: 'text',
              inTable: true,
              inForm: true,
              required: true,
            },
            {
              key: 'sending_domain_id',
              label: 'Sending Domain',
              type: 'relation',
              relation: {
                table: 'sending_domains',
                labelKey: 'domain',
                valueKey: 'id',
                filters: {
                  spf_verified: true,
                  dkim_verified: true,
                  dmarc_verified: true,
                },
              }
,              
              inTable: true,
              inForm: true,
              required: true,
            },
            {
              key: 'smtp_account_id',
              label: 'SMTP Account',
              type: 'relation',
              inTable: false,
              inForm: true,
              description: 'Selecting SMTP Account can auto-fill Email, Provider, and Sending Domain.',
              relation: {
                table: 'smtp_accounts',
                labelKey: 'username',
                valueKey: 'id',
                filters: {
                  is_valid: true,
                },
              },
              required: false,
            },
            
            {
              key: 'daily_limit',
              label: 'Daily Cap',
              type: 'number',
              inTable: false,
              inForm: false,
              required: true,
            },
            {
              key: 'hourly_limit',
              label: 'Hourly Cap',
              type: 'number',
              inTable: false,
              inForm: false,
              required: true,
            },
            {
              key: 'health_score',
              label: 'Health',
              type: 'number',
              inTable: true,
              inForm: false,
            },
            {
              key: 'sent_count',
              label: 'Sent',
              type: 'number',
              inTable: true,
              inForm: false,
            },
            {
              key: 'failed_count',
              label: 'Failed',
              type: 'number',
              inTable: true,
              inForm: false,
            },
            {
              key: 'replies_count',
              label: 'Replies',
              type: 'number',
              inTable: true,
              inForm: false,
            },
            
            {
              key: 'is_paused',
              label: 'Paused',
              type: 'boolean',
              inTable: true,
              inForm: false,
            },
          ],
          
  campaigns: [
            {
              key: 'name',
              label: 'Campaign Name',
              type: 'text',
              inTable: true,
              inForm: true,
              required: true,
            },
            {
              key: 'sequence_id',
              label: 'Sequence',
              type: 'relation',
              relation: {
                table: 'sequences',
                labelKey: 'name',
                valueKey: 'id',
              },
              inTable: true,
              inForm: true,
              required: true,
            },
            {
              key: 'operator_id',
              label: 'Operator',
              type: 'relation',
              relation: {
                table: 'operators',
                labelKey: 'name',
                valueKey: 'id',
              },
              inTable: true,
              inForm: true,
              adminOnly: true,
              required: true,
            },
            {
              key: 'status',
              label: 'Status',
              type: 'select',
              values: [
                { key: 'Draft', value: 'draft' },
                { key: 'Running', value: 'running' },
                { key: 'Paused', value: 'paused' },
              ],
              inTable: true,
              inForm: false,
            },
          ],
        
          campaign_inboxes: [
            {
              key: 'inbox_id',
              label: 'Inbox',
              type: 'relation',
              relation: {
                table: 'inboxes',
                labelKey: 'email_address',
                valueKey: 'id',
                filters: {
                  purpose: 'campaign',
                },
              },
              inTable: true,
              inForm: true,
              required: true,
            },
          ],
        
          campaign_leads: [
            {
              key: 'campaign_id',
              label: 'Campaign',
              type: 'relation',
              relation: {
                table: 'campaigns',
                labelKey: 'name',
                valueKey: 'id',
              },
              inTable: true,
              inForm: false,
              required: true,
            },
            {
              key: 'current_step',
              label: 'Current Steps',
              type: 'text',
              inTable: true,
              inForm: true,
              required: true,
            },
            {
              key: 'lead_id',
              label: 'Lead',
              type: 'relation',
              relation: {
                table: 'leads',
                labelKey: 'email',
                valueKey: 'id',
              },
              inTable: true,
              inForm: true,
              required: true,
            },
            {
              key: 'status',
              label: 'Status',
              type: 'select',
              values: [
                { key: 'Queued', value: 'queued' },
                { key: 'Processing', value: 'processing' },
                { key: 'Sent', value: 'sent' },
                { key: 'Replied', value: 'replied' },
                { key: 'Failed', value: 'failed' },
              ],
              inTable: true,
              inForm: false,
            },
          ],
          newsletter_subscribers: [
            {
              key: 'email',
              label: 'Email',
              type: 'email',
              inTable: true,
              inForm: true,
              required: true,
            },
            {
              key: 'first_name',
              label: 'First Name',
              type: 'text',
              inTable: true,
              inForm: true,
            },
            {
              key: 'last_name',
              label: 'Last Name',
              type: 'text',
              inTable: false,
              inForm: true,
            },
            {
              key: 'status',
              label: 'Status',
              type: 'select',
              values: [
                { key: 'Pending', value: 'pending' },
                { key: 'Active', value: 'active' },
                { key: 'Unsubscribed', value: 'unsubscribed' },
                { key: 'Suppressed', value: 'suppressed' },
                { key: 'Bounced', value: 'bounced' },
                { key: 'Complained', value: 'complained' },
              ],
              inTable: true,
              inForm: true,
            },
            {
              key: 'consent_source',
              label: 'Consent Source',
              type: 'text',
              inTable: true,
              inForm: true,
            },
            {
              key: 'consent_evidence',
              label: 'Consent Evidence',
              type: 'textarea',
              inTable: false,
              inForm: true,
            },
            {
              key: 'is_suppressed',
              label: 'Suppressed',
              type: 'boolean',
              inTable: true,
              inForm: true,
            },
            {
              key: 'opted_in_at',
              label: 'Opted In',
              type: 'dateTime',
              inTable: true,
              inForm: false,
              readOnly: true,
            },
          ],
          newsletter_preferences: [
            {
              key: 'subscriber_id',
              label: 'Subscriber',
              type: 'relation',
              relation: {
                table: 'newsletter_subscribers',
                labelKey: 'email',
                valueKey: 'id',
              },
              inTable: true,
              inForm: true,
              required: true,
            },
            {
              key: 'category',
              label: 'Category',
              type: 'text',
              inTable: true,
              inForm: true,
              required: true,
            },
            {
              key: 'is_enabled',
              label: 'Enabled',
              type: 'boolean',
              inTable: true,
              inForm: true,
            },
          ],
          newsletter_issues: [
            {
              key: 'title',
              label: 'Title',
              type: 'text',
              inTable: true,
              inForm: true,
              required: true,
            },
            {
              key: 'subject',
              label: 'Subject',
              type: 'text',
              inTable: true,
              inForm: true,
              required: true,
            },
            {
              key: 'body_html',
              label: 'HTML Body',
              type: 'textarea',
              inTable: false,
              inForm: true,
              required: true,
            },
            {
              key: 'status',
              label: 'Status',
              type: 'select',
              values: [
                { key: 'Draft', value: 'draft' },
                { key: 'Scheduled', value: 'scheduled' },
                { key: 'Published', value: 'published' },
                { key: 'Paused', value: 'paused' },
                { key: 'Completed', value: 'completed' },
              ],
              inTable: true,
              inForm: false,
            },
            {
              key: 'recurring_enabled',
              label: 'Recurring',
              type: 'boolean',
              inTable: true,
              inForm: true,
            },
            {
              key: 'recurring_rrule',
              label: 'Recurring Rule',
              type: 'text',
              placeholder: 'FREQ=WEEKLY or FREQ=MONTHLY',
              inTable: true,
              inForm: true,
            },
            {
              key: 'scheduled_at',
              label: 'Scheduled At',
              type: 'dateTime',
              inTable: true,
              inForm: true,
            },
            {
              key: 'published_at',
              label: 'Published At',
              type: 'dateTime',
              inTable: true,
              inForm: false,
              readOnly: true,
            },
          ],
          newsletter_send_jobs: [
            {
              key: 'issue_id',
              label: 'Issue',
              type: 'relation',
              relation: {
                table: 'newsletter_issues',
                labelKey: 'title',
                valueKey: 'id',
              },
              inTable: true,
              inForm: true,
              required: true,
            },
            {
              key: 'subscriber_id',
              label: 'Subscriber',
              type: 'relation',
              relation: {
                table: 'newsletter_subscribers',
                labelKey: 'email',
                valueKey: 'id',
              },
              inTable: true,
              inForm: true,
              required: true,
            },
            {
              key: 'status',
              label: 'Status',
              type: 'select',
              values: [
                { key: 'Queued', value: 'queued' },
                { key: 'Processing', value: 'processing' },
                { key: 'Sent', value: 'sent' },
                { key: 'Failed', value: 'failed' },
                { key: 'Suppressed', value: 'suppressed' },
                { key: 'Skipped', value: 'skipped' },
              ],
              inTable: true,
              inForm: false,
            },
            {
              key: 'scheduled_for',
              label: 'Scheduled For',
              type: 'dateTime',
              inTable: true,
              inForm: true,
            },
            {
              key: 'attempts',
              label: 'Attempts',
              type: 'number',
              inTable: true,
              inForm: false,
            },
          ],
          newsletter_send_logs: [
            {
              key: 'issue_id',
              label: 'Issue',
              type: 'relation',
              relation: {
                table: 'newsletter_issues',
                labelKey: 'title',
                valueKey: 'id',
              },
              inTable: true,
              inForm: false,
            },
            {
              key: 'subscriber_id',
              label: 'Subscriber',
              type: 'relation',
              relation: {
                table: 'newsletter_subscribers',
                labelKey: 'email',
                valueKey: 'id',
              },
              inTable: true,
              inForm: false,
            },
            {
              key: 'status',
              label: 'Status',
              type: 'text',
              inTable: true,
              inForm: false,
            },
            {
              key: 'provider_message_id',
              label: 'Provider Message ID',
              type: 'text',
              inTable: true,
              inForm: false,
            },
            {
              key: 'error',
              label: 'Error',
              type: 'text',
              inTable: true,
              inForm: false,
            },
            {
              key: 'created_at',
              label: 'Created At',
              type: 'dateTime',
              inTable: true,
              inForm: false,
            },
          ],
               
  
};
