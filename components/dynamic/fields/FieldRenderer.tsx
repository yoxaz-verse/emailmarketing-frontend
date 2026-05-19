'use client';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import SelectField from './SelectField';
import MultiSelectField from './MultiSelectField';
import { RelationMap } from '@/lib/resolveRelation';
import { cn } from '@/lib/utils';

type UiVariant = 'default' | 'campaign';

export function FieldRenderer({
  field,
  value,
  onChange,
  form,
  relations = {},
  role,
  uiVariant = 'default',
}: {
  field: any;
  value: any;
  onChange: (val: any) => void;
  form?: any;
  relations?: RelationMap;
  role?: string;
  uiVariant?: UiVariant;
}) {
  const props = { field, value, onChange, form, uiVariant };

  if (field.adminOnly && role !== 'admin' && role !== 'superadmin') {
    return null;
  }

  switch (field.type) {
    case 'text':
    case 'email':
    case 'number':
      return <TextField {...props} />;

    case 'password':
      return <PasswordField {...props} />;

    case 'textarea':
      return <TextAreaField {...props} />;

    case 'select':
      return <SelectField {...props} />;

    case 'multiselect':
      return <MultiSelectField {...props} />;

    case 'boolean':
      return <BooleanField {...props} />;

    case 'relation':
      return renderRelationField(field, value, onChange, relations, uiVariant);

    default:
      return null;
  }
}

function renderRelationField(
  field: any,
  value: any,
  onChange: (val: any) => void,
  relations: RelationMap,
  uiVariant: UiVariant
) {
  const rel = field.relation;
  const options = relations[rel.table] ?? [];
  const campaignUi = uiVariant === 'campaign';

  return (
    <div className={cn(campaignUi ? 'space-y-2' : 'space-y-1')}>
      <label className={cn('text-sm font-medium', campaignUi ? 'text-slate-100' : '')}>{field.label}</label>
      <div className="flex items-center gap-2">
        <select
          className={cn(
            'w-full rounded border p-2',
            campaignUi
              ? 'border-slate-700 bg-slate-900/70 text-slate-100 shadow-inner shadow-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/70'
              : 'border-border bg-card text-foreground'
          )}
          value={value ?? ''}
          required={field.required}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Select {field.label}</option>
          {options.map((row: any) => (
            <option
              key={row[rel.valueKey]}
              value={row[rel.valueKey]}
              disabled={Boolean(row?.__disabled)}
            >
              {getRelationOptionLabel(field, rel, row)}
            </option>
          ))}
        </select>
        {options.length === 0 && (
          <a
            href={`/dashboard/${rel.table}`}
            className="whitespace-nowrap rounded border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-800"
            title={`Add new ${field.label}`}
          >
            + Add New
          </a>
        )}
      </div>
      {field.description ? (
        <p className={cn('text-xs', campaignUi ? 'text-slate-400' : 'text-muted-foreground')}>{field.description}</p>
      ) : null}
    </div>
  );
}

function getRelationOptionLabel(field: any, rel: any, row: any): string {
  const raw = row?.[rel.labelKey];
  const baseLabel = String(raw ?? '').trim() || `Untitled ${field.label}`;

  if (rel.table === 'sequences' && row?.is_active === false) {
    return `${baseLabel} (inactive)`;
  }

  if (row?.__deleted === true) {
    return `${baseLabel} (deleted)`;
  }

  return baseLabel;
}

export function TextField({ field, value, onChange, uiVariant = 'default' }: any) {
  const campaignUi = uiVariant === 'campaign';
  return (
    <div className={cn(campaignUi ? 'space-y-2' : 'space-y-1')}>
      <label className={cn('text-sm font-medium', campaignUi ? 'text-slate-100' : '')}>{field.label}</label>
      <Input
        type={field.type}
        value={value ?? ''}
        placeholder={field.placeholder ?? field.label}
        required={field.required}
        className={cn(
          campaignUi
            ? 'h-11 border-slate-700 bg-slate-900/70 text-slate-100 placeholder:text-slate-500 focus-visible:ring-blue-500/70'
            : ''
        )}
        onChange={(e) => onChange(e.target.value)}
      />
      {field.description ? (
        <p className={cn('text-xs', campaignUi ? 'text-slate-400' : 'text-muted-foreground')}>{field.description}</p>
      ) : null}
    </div>
  );
}

export function PasswordField({ field, value, onChange, uiVariant = 'default' }: any) {
  const campaignUi = uiVariant === 'campaign';
  return (
    <div className={cn(campaignUi ? 'space-y-2' : 'space-y-1')}>
      <label className={cn('text-sm font-medium', campaignUi ? 'text-slate-100' : '')}>{field.label}</label>
      <Input
        type="password"
        value={value ?? ''}
        required={field.required}
        className={cn(
          campaignUi
            ? 'h-11 border-slate-700 bg-slate-900/70 text-slate-100 placeholder:text-slate-500 focus-visible:ring-blue-500/70'
            : ''
        )}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export function TextAreaField({ field, value, onChange, uiVariant = 'default' }: any) {
  const campaignUi = uiVariant === 'campaign';
  return (
    <div className={cn(campaignUi ? 'space-y-2' : 'space-y-1')}>
      <label className={cn('text-sm font-medium', campaignUi ? 'text-slate-100' : '')}>{field.label}</label>
      <Textarea
        value={value ?? ''}
        placeholder={field.placeholder ?? field.label}
        required={field.required}
        className={cn(
          campaignUi
            ? 'border-slate-700 bg-slate-900/70 text-slate-100 placeholder:text-slate-500 focus-visible:ring-blue-500/70'
            : ''
        )}
        onChange={(e) => onChange(e.target.value)}
      />
      {field.description ? (
        <p className={cn('text-xs', campaignUi ? 'text-slate-400' : 'text-muted-foreground')}>{field.description}</p>
      ) : null}
    </div>
  );
}

export function BooleanField({ field, value, onChange }: any) {
  const checked = !!value;

  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm font-medium">{field.label}</span>

      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
          checked ? 'bg-green-500' : 'bg-muted'
        )}
      >
        <span
          className={cn(
            'inline-block h-4 w-4 transform rounded-full bg-card transition-transform',
            checked ? 'translate-x-6' : 'translate-x-1'
          )}
        />
      </button>
    </div>
  );
}

export function DateField({ field, value, onChange }: any) {
  const type = field.type === 'dateTime' ? 'datetime-local' : field.type === 'time' ? 'time' : 'date';

  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">{field.label}</label>
      <Input type={type} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export default function TimeField({ field, value, onChange }: any) {
  return (
    <input
      type="time"
      className="w-full border border-border bg-card p-2 text-foreground"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function FileField({ field, onChange }: any) {
  return <input type="file" accept={field.accept} onChange={(e) => onChange(e.target.files?.[0])} />;
}

export function LinkField({ field, value, onChange }: any) {
  return (
    <input
      type="url"
      className="w-full border border-border bg-card p-2 text-foreground"
      placeholder={field.label}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
