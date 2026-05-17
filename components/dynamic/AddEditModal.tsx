'use client';

import { useEffect, useRef, useState } from 'react';
import { FieldRenderer } from './fields/FieldRenderer';
import { tableConfig } from '@/config/tableFields';
import { createRow, updateRow } from './action';
import { RelationMap } from '@/lib/resolveRelation';
import { executeAction } from '@/lib/action-executor';
import { clientFetch } from '@/lib/client-fetch';
import { cn } from '@/lib/utils';

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
  const isCampaignModal = table === 'campaigns';

  const [form, setForm] = useState<any>({});
  const [relationData, setRelationData] = useState<RelationMap>(relations);
  const previousProviderRef = useRef<string>('');
  const sequenceFallbackAttemptedRef = useRef(false);

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
    setRelationData(relations);
    sequenceFallbackAttemptedRef.current = false;
  }, [relations]);

  function parseSequenceActiveFlag(value: unknown): boolean {
    if (value === true || value === 1) return true;
    const normalized = String(value ?? '').trim().toLowerCase();
    return normalized === 'true' || normalized === '1';
  }

  function normalizeSequenceOptions(items: any[]): any[] {
    const seen = new Set<string>();
    const merged: any[] = [];

    for (const item of items) {
      const id = String(item?.id ?? '').trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      merged.push({
        ...item,
        is_active: parseSequenceActiveFlag(item?.is_active),
      });
    }

    merged.sort((a, b) => {
      const activeA = parseSequenceActiveFlag(a?.is_active);
      const activeB = parseSequenceActiveFlag(b?.is_active);
      if (activeA !== activeB) return activeA ? -1 : 1;
      return String(a?.name ?? '').localeCompare(String(b?.name ?? ''));
    });

    return merged;
  }

  function areSequenceListsEquivalent(left: any[], right: any[]): boolean {
    if (left.length !== right.length) return false;
    return left.every((item, index) => {
      const other = right[index];
      return (
        String(item?.id ?? '') === String(other?.id ?? '') &&
        parseSequenceActiveFlag(item?.is_active) === parseSequenceActiveFlag(other?.is_active) &&
        String(item?.name ?? '') === String(other?.name ?? '')
      );
    });
  }

  async function fetchSequenceCandidates(): Promise<any[]> {
    const requests = await Promise.allSettled([
      clientFetch<any[]>('/crud/sequences'),
      clientFetch<any[]>('/sequences'),
    ]);

    const collected: any[] = [];
    for (const request of requests) {
      if (request.status === 'fulfilled' && Array.isArray(request.value)) {
        collected.push(...request.value);
      }
    }

    return collected;
  }

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
    let cancelled = false;

    async function ensureSequenceOptions() {
      if (!isCampaignModal) return;

      const current = normalizeSequenceOptions(relationData?.sequences ?? []);
      const hasActiveSequence = current.some((item: any) => item.is_active === true);

      if (!areSequenceListsEquivalent(relationData?.sequences ?? [], current)) {
        setRelationData((prev) => ({
          ...prev,
          sequences: current,
        }));
      }

      if ((current.length > 0 && hasActiveSequence) || sequenceFallbackAttemptedRef.current) return;
      sequenceFallbackAttemptedRef.current = true;

      try {
        const rows = await fetchSequenceCandidates();
        if (cancelled) return;

        const fallback = normalizeSequenceOptions([
          ...(relationData?.sequences ?? []),
          ...rows,
        ]);

        setRelationData((prev) => ({
          ...prev,
          sequences: fallback,
        }));
      } catch (error) {
        console.warn('[AddEditModal] Unable to load fallback sequence options', { error });
      }
    }

    ensureSequenceOptions();
    return () => {
      cancelled = true;
    };
  }, [isCampaignModal, relationData?.sequences]);

  useEffect(() => {
    let cancelled = false;

    async function ensureAssignedSequenceOption() {
      if (!isEdit || table !== 'campaigns') return;

      const sequenceId = String(form.sequence_id ?? '').trim();
      if (!sequenceId) return;

      const existing = relationData?.sequences ?? [];
      const alreadyPresent = existing.some(
        (item: any) => String(item?.id ?? '') === sequenceId
      );
      if (alreadyPresent) return;

      try {
        const rows = await clientFetch<any[]>(`/crud/sequences?id=${encodeURIComponent(sequenceId)}`);
        const selected = Array.isArray(rows) ? rows[0] : null;
        if (!selected || cancelled) return;

        setRelationData((prev) => ({
          ...prev,
          sequences: normalizeSequenceOptions([...(prev?.sequences ?? []), selected]),
        }));
      } catch (error) {
        console.warn('[AddEditModal] Unable to hydrate assigned sequence option', {
          sequenceId,
          error,
        });
      }
    }

    ensureAssignedSequenceOption();
    return () => {
      cancelled = true;
    };
  }, [isEdit, table, form.sequence_id, relationData]);

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
    <div
      className={cn(
        'fixed inset-0 flex items-center justify-center px-4 py-6',
        isCampaignModal ? 'bg-slate-950/80 backdrop-blur-sm' : 'bg-black/50'
      )}
    >
      <div
        className={cn(
          'w-full max-h-[90vh] overflow-auto',
          isCampaignModal
            ? 'max-w-2xl rounded-2xl border border-slate-700/70 bg-gradient-to-b from-slate-900 to-slate-950 p-6 shadow-2xl shadow-slate-950/80 sm:p-8'
            : 'w-[520px] rounded border border-border bg-card p-6 text-card-foreground'
        )}
      >
        <div className={cn(isCampaignModal ? 'space-y-1 pb-3' : 'space-y-0')}>
          <h2 className={cn('font-semibold', isCampaignModal ? 'text-2xl text-slate-100' : 'text-lg')}>
            {isEdit ? 'Edit' : 'Add'} {table.replace('_', ' ')}
          </h2>
          {isCampaignModal ? (
            <p className="text-sm text-slate-400">
              Set the campaign name, assign a sequence, and choose the operator to start automation.
            </p>
          ) : null}
        </div>

        <div className={cn('space-y-4', isCampaignModal ? 'pt-2 space-y-5' : 'pt-0')}>
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
                relations={relationData}
                role={role}
                uiVariant={isCampaignModal ? 'campaign' : 'default'}
              />
            );
          })}
        </div>

        <div className={cn('flex justify-end gap-2 pt-4', isCampaignModal ? 'pt-6' : '')}>
          <button
            className={cn(
              'transition-colors',
              isCampaignModal
                ? 'rounded-md px-4 py-2 text-slate-300 hover:bg-slate-800/80 hover:text-white'
                : 'text-muted-foreground hover:text-foreground'
            )}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className={cn(
              'rounded px-4 transition-colors',
              isCampaignModal
                ? 'bg-blue-500 px-5 py-2 font-semibold text-white hover:bg-blue-400'
                : 'bg-primary py-1 text-primary-foreground'
            )}
            onClick={submit}
          >
            {isEdit ? 'Save' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
