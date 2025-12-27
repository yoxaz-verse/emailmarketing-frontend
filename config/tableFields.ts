// config/tableConfig.ts
export type FieldType =
  | "text"
  | "email"
  | "password"
  | "number"
  | "select"
  | "boolean"  | 'relation'
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
      values: [
        { key: "admin", value: "Admin" },
        { key: "operator", value: "Operator" },
      ],
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
      label: "Created At",
      key: "created_at",
      type: "dateTime",
      inForm: false,
      inTable: true,
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
        
          campaign_leads: [
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
