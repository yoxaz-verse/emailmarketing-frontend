// components/dynamic/fields/MultiSelectField.tsx
'use client';

export default function MultiSelectField({ field, value = [], onChange }: any) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">{field.label}</label>
      <select
        multiple
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        value={value}
        onChange={(e) =>
          onChange(
            Array.from(e.target.selectedOptions).map((o) => o.value)
          )
        }
      >
        {(field.values ?? []).map((v: any) => (
          <option key={v.key} value={v.key}>
            {v.value}
          </option>
        ))}
      </select>
    </div>
  );
}
