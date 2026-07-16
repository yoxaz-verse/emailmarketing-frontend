'use client';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import SelectField from './SelectField';
import MultiSelectField from './MultiSelectField';
import { RelationMap } from '@/lib/resolveRelation';
import { cn } from '@/lib/utils';
import { MODULE_ACCESS_KEYS, MODULE_ACCESS_LABELS, normalizeModuleAccessFlags } from '@/lib/dashboard-access';

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

    case 'moduleAccess':
      return <ModuleAccessField {...props} />;

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
      <label className={cn('text-sm font-medium', campaignUi ? 'text-foreground dark:text-slate-100' : '')}>{field.label}</label>
      <div className="flex items-center gap-2">
        <select
          className={cn(
            'w-full rounded border p-2',
            campaignUi
              ? 'border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/70 dark:border-border dark:bg-background/70 dark:text-foreground dark:placeholder:text-muted-foreground dark:shadow-inner dark:shadow-black'
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
            className="whitespace-nowrap rounded border border-primary/30 bg-primary/10 px-2 py-1 text-xs font-medium text-primary hover:text-primary/80"
            title={`Add new ${field.label}`}
          >
            + Add New
          </a>
        )}
      </div>
      {field.description ? (
        <p className={cn('text-xs', campaignUi ? 'text-muted-foreground dark:text-slate-400' : 'text-muted-foreground')}>{field.description}</p>
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
      <label className={cn('text-sm font-medium', campaignUi ? 'text-foreground dark:text-slate-100' : '')}>{field.label}</label>
      <Input
        type={field.type}
        value={value ?? ''}
        placeholder={field.placeholder ?? field.label}
        required={field.required}
        className={cn(
          campaignUi
            ? 'h-11 border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/70 dark:border-border dark:bg-background/70 dark:text-foreground dark:placeholder:text-muted-foreground'
            : ''
        )}
        onChange={(e) => onChange(e.target.value)}
      />
      {field.description ? (
        <p className={cn('text-xs', campaignUi ? 'text-muted-foreground dark:text-slate-400' : 'text-muted-foreground')}>{field.description}</p>
      ) : null}
    </div>
  );
}

export function PasswordField({ field, value, onChange, uiVariant = 'default' }: any) {
  const campaignUi = uiVariant === 'campaign';
  return (
    <div className={cn(campaignUi ? 'space-y-2' : 'space-y-1')}>
      <label className={cn('text-sm font-medium', campaignUi ? 'text-foreground dark:text-slate-100' : '')}>{field.label}</label>
      <Input
        type="password"
        value={value ?? ''}
        required={field.required}
        className={cn(
          campaignUi
            ? 'h-11 border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/70 dark:border-border dark:bg-background/70 dark:text-foreground dark:placeholder:text-muted-foreground'
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
      <label className={cn('text-sm font-medium', campaignUi ? 'text-foreground dark:text-slate-100' : '')}>{field.label}</label>
      <Textarea
        value={value ?? ''}
        placeholder={field.placeholder ?? field.label}
        required={field.required}
        className={cn(
          campaignUi
            ? 'border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/70 dark:border-border dark:bg-background/70 dark:text-foreground dark:placeholder:text-muted-foreground'
            : ''
        )}
        onChange={(e) => onChange(e.target.value)}
      />
      {field.description ? (
        <p className={cn('text-xs', campaignUi ? 'text-muted-foreground dark:text-slate-400' : 'text-muted-foreground')}>{field.description}</p>
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

export function ModuleAccessField({ field, value, onChange, form }: any) {
  const role = String(form?.role ?? '').toLowerCase();
  const isAdmin = role === 'admin' || role === 'superadmin';
  const flags = normalizeModuleAccessFlags(value ?? {}, role);

  return (
    <div className="space-y-3 rounded-md border border-border bg-muted/20 p-3">
      <div>
        <p className="text-sm font-medium">{field.label}</p>
        {field.description ? (
          <p className="mt-1 text-xs text-muted-foreground">{field.description}</p>
        ) : null}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {MODULE_ACCESS_KEYS.map((key) => {
          const checked = flags[key] === true;
          return (
            <button
              key={key}
              type="button"
              disabled={isAdmin}
              onClick={() => onChange({ ...flags, [key]: !checked })}
              className={cn(
                'flex min-h-10 items-center justify-between gap-3 rounded-md border px-3 py-2 text-left text-sm transition-colors',
                checked
                  ? 'border-primary/50 bg-primary/10 text-foreground'
                  : 'border-border bg-background text-muted-foreground',
                isAdmin ? 'cursor-not-allowed opacity-70' : 'hover:border-primary/40 hover:text-foreground'
              )}
            >
              <span className="font-medium">{MODULE_ACCESS_LABELS[key]}</span>
              <span
                className={cn(
                  'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
                  checked ? 'bg-green-500' : 'bg-muted'
                )}
              >
                <span
                  className={cn(
                    'inline-block h-3.5 w-3.5 transform rounded-full bg-card transition-transform',
                    checked ? 'translate-x-5' : 'translate-x-1'
                  )}
                />
              </span>
            </button>
          );
        })}
      </div>
      {isAdmin ? (
        <p className="text-xs text-muted-foreground">Admins have full access automatically.</p>
      ) : null}
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
