// components/dynamic/fields/SelectField.tsx
'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

export default function SelectField({ field, value, onChange, form, uiVariant = 'default' }: any) {
  const [options, setOptions] = useState<any[]>([]);
  const campaignUi = uiVariant === 'campaign';

  useEffect(() => {
    async function load() {
      if (field.dependsOn) {
        const dep = form[field.dependsOn];
        if (!dep) return;
        setOptions(await field.dynamicValuesFn(dep));
      } else if (field.dynamicValuesFn) {
        setOptions(await field.dynamicValuesFn());
      } else {
        setOptions(field.values ?? []);
      }
    }
    load();
  }, [form[field.dependsOn]]);

  return (
    <div className={cn(campaignUi ? 'space-y-2' : 'space-y-1')}>
      <label className={cn('text-sm font-medium', campaignUi ? 'text-foreground dark:text-slate-100' : '')}>{field.label}</label>
      <select
        className={cn(
          'w-full rounded-md border px-3 py-2 text-sm',
          campaignUi
            ? 'h-11 border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/70 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100 dark:placeholder:text-slate-500 dark:shadow-inner dark:shadow-slate-900'
            : 'border-input bg-background'
        )}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Select {field.label}</option>
        {options.map((o) => (
          <option key={o.key} value={o.key}>
            {o.value}
          </option>
        ))}
      </select>
    </div>
  );
}
