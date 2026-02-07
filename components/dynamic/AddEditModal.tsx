'use client';

import { useEffect, useState } from 'react';
import { FieldRenderer } from './fields/FieldRenderer';
import { tableConfig } from '@/config/tableFields';
import { createRow, updateRow } from './action';
import { RelationMap } from '@/lib/resolveRelation';
import { executeAction } from '@/lib/action-executor';

type Props = {
  table: string;
  row?: any;
  relations?: RelationMap;
  role?: string;
  onClose: () => void;
  onSuccess: () => void;
  defaultValues?: Record<string, any>
};

export default function AddEditModal({
  table,
  row,
  relations = {},
  role,
  onClose,
  onSuccess,
  defaultValues = {},   // 👈 ADD THIS

}: Props) {
  const config = tableConfig[table];
  const isEdit = !!row;

  const [form, setForm] = useState<any>({});

  useEffect(() => {
    const initial: any = {};

    // 1️⃣ Inject defaultValues FIRST (hidden FKs, parent context)
    Object.entries(defaultValues).forEach(([key, value]) => {
      initial[key] = value;
    });

    // 2️⃣ Merge row values on edit (including hidden fields)
    if (row) {
      Object.entries(row).forEach(([key, value]) => {
        if (value !== undefined) {
          initial[key] = value;
        }
      });
    }

    // 3️⃣ Ensure visible form fields exist
    config.forEach((f) => {
      if (!f.inForm) return;
      if (isEdit && f.inEdit === false) return;

      if (initial[f.key] === undefined) {
        initial[f.key] = '';
      }
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
    const label = table.replace('_', ' ');
    const res = await executeAction(
      () => (isEdit ? updateRow(table, row.id, form) : createRow(table, form)),
      {
        success: `${label} ${isEdit ? 'updated' : 'created'}`,
        error: `Failed to ${isEdit ? 'update' : 'create'} ${label}`,
      }
    );

    if (res !== undefined) {
      onSuccess();
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
      <div className="bg-white p-6 rounded w-[520px] space-y-4 max-h-[90vh] overflow-auto">
        <h2 className="text-lg font-semibold">
          {isEdit ? 'Edit' : 'Add'}           {table.replace('_', ' ')}
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
