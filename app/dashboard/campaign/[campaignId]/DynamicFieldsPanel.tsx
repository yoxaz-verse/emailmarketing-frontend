'use client';

import { useEffect, useMemo, useState } from 'react';
import { Braces, CheckCircle2, TriangleAlert } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import type {
  CampaignMergeMapping,
  CampaignPersonalizationState,
} from '@/lib/server/campaign-workspace';
import { updateCampaignDynamicFields } from './actions';

type Props = {
  campaignId: string;
  campaignStatus: string;
  personalization: CampaignPersonalizationState;
};

const fieldClass = 'h-9 w-full rounded-md border border-border bg-background px-3 text-sm dark:border-white/[0.14] dark:bg-black/30';
const fieldLabels: Record<string, string> = {
  email: 'Email', first_name: 'First Name', last_name: 'Last Name', company: 'Company',
  job_title: 'Job Title', country: 'Country', phone: 'Phone', linkedin_url: 'LinkedIn URL',
  website: 'Website', company_description: 'Company Description', industry: 'Industry',
  employee_size: 'Employee Size', source: 'Source', notes: 'Notes',
};

function initialMappings(state: CampaignPersonalizationState): CampaignMergeMapping[] {
  const saved = new Map(state.mappings.map((mapping) => [mapping.placeholder_key, mapping]));
  return state.placeholders.map((placeholder) => saved.get(placeholder.key) ?? {
    placeholder_key: placeholder.key,
    placeholder_label: placeholder.label,
    source_type: placeholder.suggested_lead_field ? 'lead_field' : 'fixed_text',
    lead_field: placeholder.suggested_lead_field,
    fixed_value: null,
    required: true,
  });
}

export default function DynamicFieldsPanel({ campaignId, campaignStatus, personalization }: Props) {
  const router = useRouter();
  const [mappings, setMappings] = useState(() => initialMappings(personalization));
  const [saving, setSaving] = useState(false);
  const locked = String(campaignStatus).toLowerCase() === 'running';

  useEffect(() => setMappings(initialMappings(personalization)), [personalization]);

  const unresolved = useMemo(() => mappings.filter((mapping) => (
    mapping.source_type === 'lead_field' ? !mapping.lead_field : !String(mapping.fixed_value ?? '').trim()
  )).length, [mappings]);

  function updateMapping(key: string, patch: Partial<CampaignMergeMapping>) {
    setMappings((current) => current.map((mapping) => mapping.placeholder_key === key ? { ...mapping, ...patch } : mapping));
  }

  function preview(mapping: CampaignMergeMapping) {
    if (mapping.source_type === 'fixed_text') return String(mapping.fixed_value ?? '').trim() || 'No fixed value';
    const value = mapping.lead_field ? personalization.sample_lead?.[mapping.lead_field] : null;
    return value == null || String(value).trim() === '' ? 'No sample value' : String(value);
  }

  async function save() {
    if (saving || locked || unresolved > 0) return;
    try {
      setSaving(true);
      const result = await updateCampaignDynamicFields(campaignId, mappings);
      if (!result.success) throw new Error(result.error);
      toast.success('Dynamic fields reviewed and saved.');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save dynamic fields');
    } finally {
      setSaving(false);
    }
  }

  if (personalization.placeholders.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-card/50 p-5 dark:border-white/[0.14] dark:bg-white/[0.055]">
        <div className="flex items-center gap-2"><Braces className="size-4 text-primary" /><h2 className="font-semibold">Dynamic fields</h2></div>
        <p className="mt-2 text-sm text-muted-foreground">This sequence has no dynamic fields. Add placeholders such as {'{{First Name}}'} to a sequence step to personalize it.</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-card/50 p-5 dark:border-white/[0.14] dark:bg-white/[0.055]">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <div className="flex items-center gap-2"><Braces className="size-4 text-primary" /><h2 className="font-semibold">Dynamic fields</h2></div>
          <p className="mt-1 text-xs text-muted-foreground">Map each sequence placeholder to a lead field or one campaign-wide value.</p>
        </div>
        <div className="flex items-center gap-3">
          {personalization.reviewed && !personalization.stale ? (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-300"><CheckCircle2 className="size-4" />Reviewed</span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300"><TriangleAlert className="size-4" />Review required</span>
          )}
          <Button onClick={() => void save()} disabled={saving || locked || unresolved > 0}>
            {saving ? 'Saving…' : 'Save and review'}
          </Button>
        </div>
      </div>

      {personalization.stale ? <div className="mt-4 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-300">The sequence placeholders changed after the last review. Check and save these mappings again.</div> : null}
      {locked ? <div className="mt-4 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-300">Pause the campaign before changing dynamic fields.</div> : null}

      <div className="mt-4 space-y-3">
        {mappings.map((mapping) => {
          const placeholder = personalization.placeholders.find((item) => item.key === mapping.placeholder_key);
          return (
            <div key={mapping.placeholder_key} className="grid gap-3 rounded-lg border border-border/70 p-4 dark:border-white/[0.12] dark:bg-black/20 lg:grid-cols-[1.1fr_0.8fr_1.3fr_1fr] lg:items-end">
              <div>
                <div className="text-xs text-muted-foreground">Placeholder</div>
                <div className="mt-1 font-mono text-sm">{'{{'}{mapping.placeholder_label}{'}}'}</div>
                <div className="mt-1 text-[11px] text-muted-foreground">{placeholder?.usages.map((usage) => `Step ${usage.step_number} ${usage.location}`).join(' · ')}</div>
              </div>
              <label className="text-xs text-muted-foreground">Source
                <select className={`${fieldClass} mt-1`} value={mapping.source_type} disabled={locked} onChange={(event) => updateMapping(mapping.placeholder_key, {
                  source_type: event.target.value as CampaignMergeMapping['source_type'], lead_field: null, fixed_value: null,
                })}>
                  <option value="lead_field">Lead field</option>
                  <option value="fixed_text">Fixed text</option>
                </select>
              </label>
              {mapping.source_type === 'lead_field' ? (
                <label className="text-xs text-muted-foreground">Lead field
                  <select className={`${fieldClass} mt-1`} value={mapping.lead_field ?? ''} disabled={locked} onChange={(event) => updateMapping(mapping.placeholder_key, { lead_field: event.target.value || null })}>
                    <option value="">Select lead field</option>
                    {personalization.allowed_lead_fields.map((field) => <option key={field} value={field}>{fieldLabels[field] ?? field}</option>)}
                  </select>
                </label>
              ) : (
                <label className="text-xs text-muted-foreground">Fixed value
                  <input className={`${fieldClass} mt-1`} value={mapping.fixed_value ?? ''} disabled={locked} placeholder={mapping.placeholder_label === 'Sender Name' ? 'OBAOL Team' : 'Enter campaign value'} onChange={(event) => updateMapping(mapping.placeholder_key, { fixed_value: event.target.value })} />
                </label>
              )}
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">Sample preview</div>
                <div className="mt-1 truncate text-sm" title={preview(mapping)}>{preview(mapping)}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-4 text-xs">
        <span className={unresolved ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-600 dark:text-emerald-300'}>{unresolved} unresolved mapping{unresolved === 1 ? '' : 's'}</span>
        <span className={personalization.missing_lead_count ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground'}>{personalization.missing_lead_count} attached lead{personalization.missing_lead_count === 1 ? '' : 's'} missing required values</span>
      </div>
      {personalization.missing_leads.length ? (
        <div className="mt-3 max-h-32 overflow-y-auto rounded-md border border-border/70 p-3 text-xs text-muted-foreground">
          {personalization.missing_leads.map((lead) => <div key={lead.campaign_lead_id}>{lead.email || lead.lead_id}: {lead.missing.join(', ')}</div>)}
        </div>
      ) : null}
    </section>
  );
}
