'use client';

import { useEffect, useState } from 'react';
import { TableField } from '@/config/tableFields';
import { serverFetch } from '@/lib/server/server-fetch';

type Props = {
  field: TableField;
  value: any;
  onChange: (val: any) => void;
};

export default function RelationField({
  field,
  value,
  onChange,
}: Props) {
  const [options, setOptions] = useState<any[]>([]);
  const relation = field.relation!;

  useEffect(() => {
    let mounted = true;

    async function load() {
      const params = new URLSearchParams();

      // ✅ FLATTEN filters to match listRows contract
      if (relation.filters) {
        for (const [key, val] of Object.entries(relation.filters)) {
          params.set(key, String(val));
        }
      }

      const rows = await serverFetch<any[]>(
        `/crud/${relation.table}?${params.toString()}`
      );

      if (!mounted) return;
      setOptions(rows);
    }

    load();
    return () => {
      mounted = false;
    };
  }, [relation.table]);

  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">{field.label}</label>

      <select
        className="border p-2 rounded w-full"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Select {field.label}</option>

        {options.map((row) => (
          <option
            key={row[relation.valueKey]}
            value={row[relation.valueKey]}
          >
            {row[relation.labelKey]}
          </option>
        ))}
      </select>
    </div>
  );
}
