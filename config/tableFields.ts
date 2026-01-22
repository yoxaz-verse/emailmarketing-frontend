// config/tableConfig.ts
export type FieldType =
  | "text"
  | "email"
  | "password"
  | "number"
  | "select"
  | "boolean"  
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
      label: "Company",
      key: "company",
      type: "text",
      inForm: true,
      inTable: true,

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
      inTable: false,
      inForm: true,
      adminOnly: true,
      required: true,
    },

    {
      key: 'email_eligibility',
      label: 'Email Eligibility',
      type: 'text',
      inTable: false,
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
              label: 'Campaign Name',
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
              type: 'text',
              inTable: true,
              inForm: true,
              required: true,
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
              inTable: false,
              inForm: true,
              required: true,
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
              },
              inTable: true,
              inForm: true,
              required: true,
            },
          ],
        
          campaign_leads: [
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
               
  
};
