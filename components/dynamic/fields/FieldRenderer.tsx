'use client';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import SelectField from './SelectField';
import MultiSelectField from './MultiSelectField';
import { RelationMap } from '@/lib/resolveRelation';

export function FieldRenderer({
  field,
  value,
  onChange,
  form,
  relations = {},
  role,

}: {
  field: any;
  value: any;
  onChange: (val: any) => void;
  form?: any;
  relations?: RelationMap;
  role?: string;

}) {
  const props = { field, value, onChange, form };
// 🔒 adminOnly enforcement (UI-level)
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
      return renderRelationField(field, value, onChange, relations);

    default:
      return null;
  }
}


function renderRelationField(
  field: any,
  value: any,
  onChange: (val: any) => void,
  relations: RelationMap
) {
  const rel = field.relation;
  const options = relations[rel.table] ?? [];

  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">{field.label}</label>
      <select
        className="border p-2 rounded w-full"
        value={value ?? ''}
        required={field.required}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Select {field.label}</option>
        {options.map((row: any) => (
          <option
            key={row[rel.valueKey]}
            value={row[rel.valueKey]}
          >
            {row[rel.labelKey]}
          </option>
        ))}
      </select>
    </div>
  );
}


export  function TextField({ field, value, onChange }: any) {
    return (
      <div className="space-y-1">
        <label className="text-sm font-medium">{field.label}</label>
        <Input
          type={field.type}
          value={value ?? ''}
          required={field.required}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    );
  }
  


  export  function PasswordField({ field, value, onChange }: any) {
    return (
      <div className="space-y-1">
        <label className="text-sm font-medium">{field.label}</label>
        <Input
          type="password"
          value={value ?? ''}
          required={field.required}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    );
  }



export  function TextAreaField({ field, value, onChange }: any) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">{field.label}</label>
      <Textarea
        value={value ?? ''}
        required={field.required}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}







import { cn } from "@/lib/utils";

export function BooleanField({ field, value, onChange }: any) {
  const checked = !!value;

  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm font-medium">
        {field.label}
      </span>

      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
          checked ? "bg-green-600" : "bg-gray-300"
        )}
      >
        <span
          className={cn(
            "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
            checked ? "translate-x-6" : "translate-x-1"
          )}
        />
      </button>
    </div>
  );
}





export  function DateField({ field, value, onChange }: any) {
  const type =
    field.type === 'dateTime'
      ? 'datetime-local'
      : field.type === 'time'
      ? 'time'
      : 'date';

  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">{field.label}</label>
      <Input
        type={type}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}





export default function TimeField({ field, value, onChange }: any) {
  return (
    <input
      type="time"
      className="border p-2 w-full"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}


export  function FileField({ field, onChange }: any) {
  return (
    <input
      type="file"
      accept={field.accept}
      onChange={(e) => onChange(e.target.files?.[0])}
    />
  );
}


export  function LinkField({ field, value, onChange }: any) {
  return (
    <input
      type="url"
      className="border p-2 w-full"
      placeholder={field.label}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
