'use client';

import { useEffect, useRef, useState } from 'react';
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
  const previousProviderRef = useRef<string>('');

  const SMTP_PROVIDER_PRESETS: Record<
    string,
    { host: string; port: number; encryption: 'tls' | 'ssl' }
  > = {
    mxroute: {
      host: 'chocobo.mxrouting.net',
      port: 587,
      encryption: 'tls',
    },
    google: {
      host: 'smtp.gmail.com',
      port: 587,
      encryption: 'tls',
    },
  };

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
  }, [row, table, defaultValues, config, isEdit]);

  useEffect(() => {
    if (table !== 'smtp_accounts') return;

    const provider = String(form.provider ?? '').toLowerCase().trim();
    if (!provider || provider === previousProviderRef.current) return;
    previousProviderRef.current = provider;

    const preset = SMTP_PROVIDER_PRESETS[provider];
    if (!preset) return;

    setForm((prev: any) => ({
      ...prev,
      host: prev.host ? prev.host : preset.host,
      port: prev.port ? prev.port : preset.port,
      encryption: prev.encryption ? prev.encryption : preset.encryption,
    }));
  }, [form.provider, table]);

  useEffect(() => {
    if (table !== 'inboxes') return;

    const smtpAccountId = String(form.smtp_account_id ?? '').trim();
    if (!smtpAccountId) return;

    const smtpAccounts = relations?.smtp_accounts ?? [];
    const selectedSmtp = smtpAccounts.find(
      (row: any) => String(row.id) === smtpAccountId
    );

    if (!selectedSmtp) return;

    setForm((prev: any) => ({
      ...prev,
      email_address: prev.email_address
        ? prev.email_address
        : String(selectedSmtp.username ?? ''),
      provider: prev.provider
        ? prev.provider
        : String(selectedSmtp.provider ?? ''),
      sending_domain_id: prev.sending_domain_id
        ? prev.sending_domain_id
        : String(selectedSmtp.sending_domain_id ?? ''),
    }));
  }, [form.smtp_account_id, table, relations]);


  function update(key: string, value: any) {
    setForm((prev: any) => ({
      ...prev,
      [key]: value,
    }));
  }

  function normalizeSmtpUsername(payload: Record<string, any>) {
    if (table !== 'smtp_accounts') return payload;

    const usernameRaw = String(payload.username ?? '').trim();
    if (!usernameRaw || usernameRaw.includes('@')) return payload;

    const sendingDomainId = payload.sending_domain_id;
    if (!sendingDomainId) return payload;

    const domains = relations?.sending_domains ?? [];
    const matchedDomain = domains.find(
      (row: any) => String(row.id) === String(sendingDomainId)
    );
    const domain = String(matchedDomain?.domain ?? '').trim().toLowerCase();
    if (!domain) return payload;

    return {
      ...payload,
      username: `${usernameRaw}@${domain}`,
    };
  }

  async function submit() {
    const label = table.replace('_', ' ');
    const normalizedForm = normalizeSmtpUsername(form);
    const res = await executeAction(
      () => (isEdit ? updateRow(table, row.id, normalizedForm) : createRow(table, normalizedForm)),
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
      <div className="bg-card text-card-foreground border border-border p-6 rounded w-[520px] space-y-4 max-h-[90vh] overflow-auto">
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
          <button className="text-muted-foreground hover:text-foreground" onClick={onClose}>
            Cancel
          </button>
          <button
            className="bg-primary text-primary-foreground px-4 py-1 rounded"
            onClick={submit}
          >
            {isEdit ? 'Save' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
