'use client';

import { useEffect, useState } from 'react';
import { FieldRenderer } from './fields/FieldRenderer';
import { tableConfig } from '@/config/tableFields';
import { createRow, updateRow } from './action';
import { RelationMap } from '@/lib/resolveRelation';

type Props = {
  table: string;
  row?: any;
  relations?: RelationMap;
  role?: string;
  onClose: () => void;
  onSuccess: () => void;
};

export default function AddEditModal({
  table,
  row,
  relations = {},
  role,
  onClose,
  onSuccess,
}: Props) {
  const config = tableConfig[table];
  const isEdit = !!row;

  const [form, setForm] = useState<any>({});

  useEffect(() => {
    const initial: any = {};
    config.forEach((f) => {
      if (!f.inForm) return;
      if (isEdit && f.inEdit === false) return;
      initial[f.key] = row?.[f.key] ?? '';
    });
    setForm(initial);
  }, [row, table]);

  function update(key: string, value: any) {
    setForm((prev: any) => ({
      ...prev,
      [key]: value,
    }));
  }

  async function submit() {
    if (isEdit) {
      await updateRow(table, row.id, form);
    } else {
      await createRow(table, form);
    }
    onSuccess();
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
      <div className="bg-white p-6 rounded w-[520px] space-y-4 max-h-[90vh] overflow-auto">
        <h2 className="text-lg font-semibold">
          {isEdit ? 'Edit' : 'Add'} {table}
        </h2>

        {config.map((field) => {
          if (!field.inForm) return null;
          if (isEdit && field.inEdit === false) return null;

          return (
            <FieldRenderer
              key={field.key}
              field={field}
              value={form[field.key]}
              onChange={(val: any) => update(field.key, val)}
              form={form}
              relations={relations}
              role={role}
            />
          );
        })}

        <div className="flex justify-end gap-2 pt-4">
          <button onClick={onClose}>Cancel</button>
          <button
            className="bg-black text-white px-4 py-1 rounded"
            onClick={submit}
          >
            {isEdit ? 'Save' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
