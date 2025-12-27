// components/dynamic/fields/SelectField.tsx
'use client';

import { useEffect, useState } from 'react';

export default function SelectField({ field, value, onChange, form }: any) {
  const [options, setOptions] = useState<any[]>([]);

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
    <div className="space-y-1">
      <label className="text-sm font-medium">{field.label}</label>
      <select
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
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
