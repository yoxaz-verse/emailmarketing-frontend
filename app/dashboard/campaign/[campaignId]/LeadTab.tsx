'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { attachFolderLeadsAction, attachLeadsAction, detachLeadsAction } from './actions';

type Lead = {
  id: string;
  email?: string | null;
  folder_id?: string | null;
  is_blocked?: boolean;
  is_used?: boolean | null;
  permanently_failed?: boolean | null;
  free_provider?: boolean | null;
  is_free_provider?: boolean | null;
  email_eligibility?: string | null;
  email_eligibility_reason?: string | null;
};

type LeadBucket = 'valid' | 'risky' | 'pending' | 'invalid' | 'blocked' | 'used';

type AttachedLeadRow = {
  id: string;
  email: string;
  source: 'known' | 'orphan';
  bucket: LeadBucket;
  freeProvider: boolean;
};

function bucketLabel(bucket: LeadBucket): string {
  if (bucket === 'valid') return 'qualified';
  if (bucket === 'risky') return 'risky';
  if (bucket === 'used') return 'used';
  if (bucket === 'pending') return 'pending';
  if (bucket === 'blocked') return 'blocked';
  return 'invalid';
}

function classifyLead(lead: Lead): LeadBucket {
  if (lead.is_blocked === true || lead.permanently_failed === true) return 'blocked';
  if (lead.is_used === true) return 'used';

  const eligibility = String(lead.email_eligibility ?? '').toLowerCase();
  if (eligibility === 'eligible' || eligibility === 'valid' || eligibility === 'validated') return 'valid';
  if (eligibility === 'risky') return 'risky';
  if (eligibility === 'pending') return 'pending';

  return 'invalid';
}

function classifyAttachedLead(lead: Lead): LeadBucket {
  if (lead.is_blocked === true || lead.permanently_failed === true) return 'blocked';
  const eligibility = String(lead.email_eligibility ?? '').toLowerCase();
  if (eligibility === 'eligible' || eligibility === 'valid' || eligibility === 'validated') return 'valid';
  if (eligibility === 'risky') return 'risky';
  if (eligibility === 'pending') return 'pending';
  return 'invalid';
}

function matchesQuery(value: string, query: string) {
  if (!query.trim()) return true;
  return value.toLowerCase().includes(query.trim().toLowerCase());
}

function isFreeProvider(lead: Lead): boolean {
  return lead.free_provider === true || lead.is_free_provider === true;
}

function getMutationErrorMessage(error: unknown): string {
  const raw = (() => {
    if (typeof error === 'string') return error;
    if (error instanceof Error) return error.message;
    if (typeof error === 'object' && error !== null) {
      const withMessage = error as { message?: unknown; error?: unknown };
      if (typeof withMessage.message === 'string' && withMessage.message.trim()) return withMessage.message;
      if (typeof withMessage.error === 'string' && withMessage.error.trim()) return withMessage.error;
    }
    return 'Unknown error';
  })();
  let parsedCode = '';
  try {
    const parsed = JSON.parse(raw) as { code?: unknown; error?: unknown; message?: unknown };
    if (typeof parsed?.code === 'string') parsedCode = parsed.code;
  } catch {
    parsedCode = '';
  }
  const lower = raw.toLowerCase();
  if (parsedCode === 'CAMPAIGN_LEAD_TRACKING_CONFLICT' || lower.includes('campaign_lead_tracking_conflict')) {
    return 'This lead has tracking history linked to it. Run the FK migration for campaign lead tracking (ON DELETE SET NULL), then retry remove.';
  }
  if (
    lower.includes('email_tracking_events_campaign_lead_id_fkey') ||
    lower.includes('email_logs_campaign_lead_id_fkey') ||
    (lower.includes('foreign key') && lower.includes('campaign_leads'))
  ) {
    return 'Removal blocked by tracking-history foreign key. Apply the FK migration (campaign_lead_id -> ON DELETE SET NULL) and retry.';
  }
  if (raw.includes('Cannot POST') && raw.includes('/campaigns/') && raw.includes('/leads/detach')) {
    return 'Detach route is unavailable on backend. Please restart/deploy backend and retry.';
  }
  if (lower.includes('column') && lower.includes('is_blocked') && lower.includes('does not exist')) {
    return 'Backend schema mismatch: leads.is_blocked is missing. Deploy/restart patched backend and verify NEXT_PUBLIC_API_BASE_URL points to it.';
  }
  if (lower.includes('unauthorized') || lower.includes('forbidden') || lower.includes('operator access required')) {
    return 'Session/permission mismatch. Sign in again and verify this campaign belongs to your operator account.';
  }
  if (lower.includes('backend unavailable')) {
    return 'Backend unavailable. Please ensure API server is running.';
  }
  return raw;
}

export default function LeadsTab({
  campaign,
  leads,
  allLeads,
  campaignLeads,
  leadFolders,
  mutationHealth,
}: {
  campaign: { id: string; status?: string | null };
  leads: Lead[];
  allLeads: Lead[];
  campaignLeads: { lead_id: string }[];
  leadFolders: { id: string; name: string; lead_count?: number }[];
  mutationHealth?: {
    ok: boolean;
    reason?: string;
    routeContractVersion?: string;
  };
}) {
  const router = useRouter();
  const isLeadMutationLocked = String(campaign?.status ?? '').toLowerCase() === 'running';
  const leadMutationLockedMessage = 'Lead changes are locked while this campaign is running. Pause campaign to add or remove leads.';

  const attachedLeadIdsFromProps = useMemo(
    () => Array.from(new Set(campaignLeads.map((cl) => String(cl.lead_id)))),
    [campaignLeads]
  );
  const [attachedLeadIdsState, setAttachedLeadIdsState] = useState<string[]>(attachedLeadIdsFromProps);
  const attachedLeadIdSet = useMemo(() => new Set(attachedLeadIdsState), [attachedLeadIdsState]);
  const [isMutating, setIsMutating] = useState(false);

  useEffect(() => {
    setAttachedLeadIdsState(attachedLeadIdsFromProps);
  }, [attachedLeadIdsFromProps]);

  const allLeadMap = useMemo(() => {
    const map = new Map<string, Lead>();
    for (const lead of allLeads) {
      map.set(String(lead.id), lead);
    }
    return map;
  }, [allLeads]);

  const attachedRows = useMemo<AttachedLeadRow[]>(() => {
    return Array.from(attachedLeadIdSet).map((leadId) => {
      const lead = allLeadMap.get(leadId);
      if (!lead) {
        return {
          id: leadId,
          email: `Unknown lead ${leadId}`,
          source: 'orphan',
          bucket: 'invalid',
          freeProvider: false,
        };
      }
      if (classifyLead(lead) === 'blocked') {
        return null;
      }
      const attachedBucket = classifyAttachedLead(lead);
      return {
        id: leadId,
        email: String(lead.email ?? `Unknown lead ${leadId}`),
        source: 'known',
        bucket: attachedBucket,
        freeProvider: isFreeProvider(lead),
      };
    }).filter((row): row is AttachedLeadRow => row != null);
  }, [allLeadMap, attachedLeadIdSet]);

  const [sourceId, setSourceId] = useState<string>('all');
  const selectedFolderId = sourceId.startsWith('folder:') ? sourceId.slice('folder:'.length) : '';

  const candidateScopeLeads = useMemo(() => {
    if (selectedFolderId) {
      return leads.filter((lead) => String(lead.folder_id ?? '') === selectedFolderId);
    }
    return leads;
  }, [leads, selectedFolderId]);

  const validCandidates = candidateScopeLeads.filter((lead) => classifyLead(lead) === 'valid');
  const riskyCandidates = candidateScopeLeads.filter((lead) => classifyLead(lead) === 'risky');

  const attachableRows = candidateScopeLeads.filter((lead) => {
    const bucket = classifyLead(lead);
    return !attachedLeadIdSet.has(String(lead.id)) && (bucket === 'valid' || bucket === 'risky');
  });

  const excludedRows = candidateScopeLeads.filter((lead) => {
    const bucket = classifyLead(lead);
    return !attachedLeadIdSet.has(String(lead.id)) && bucket !== 'valid' && bucket !== 'risky' && bucket !== 'used';
  });

  const [selectedAttachedIds, setSelectedAttachedIds] = useState<Set<string>>(new Set());
  const [selectedUnassignedIds, setSelectedUnassignedIds] = useState<Set<string>>(new Set());
  const [activeEligibilityTab, setActiveEligibilityTab] = useState<'eligible' | 'ineligible'>('eligible');

  const [attachedSearch, setAttachedSearch] = useState('');
  const [eligibleSearch, setEligibleSearch] = useState('');
  const [ineligibleSearch, setIneligibleSearch] = useState('');
  const [draggingLeadId, setDraggingLeadId] = useState<string | null>(null);
  const [dragSource, setDragSource] = useState<'attached' | 'unassigned' | null>(null);
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
  const [removeTargetCount, setRemoveTargetCount] = useState(0);
  const [removePending, setRemovePending] = useState(false);

  const attachedVisible = attachedRows.filter((row) => matchesQuery(row.email, attachedSearch));
  const unassignedVisible = attachableRows.filter((row) => matchesQuery(String(row.email ?? ''), eligibleSearch));
  const excludedVisible = excludedRows.filter((row) => matchesQuery(String(row.email ?? ''), ineligibleSearch));
  const attachedVisibleIds = useMemo(() => attachedVisible.map((row) => row.id), [attachedVisible]);
  const unassignedVisibleIds = useMemo(() => unassignedVisible.map((lead) => String(lead.id)), [unassignedVisible]);
  const excludedVisibleIds = useMemo(() => excludedVisible.map((lead) => String(lead.id)), [excludedVisible]);
  const ineligibleBreakdown = useMemo(() => {
    const counts: Record<LeadBucket, number> = {
      valid: 0,
      risky: 0,
      pending: 0,
      invalid: 0,
      blocked: 0,
      used: 0,
    };
    for (const lead of excludedRows) {
      counts[classifyLead(lead)] += 1;
    }
    return counts;
  }, [excludedRows]);
  const attachedNonQualifiedCount = useMemo(
    () => attachedRows.filter((row) => row.bucket !== 'valid' && row.bucket !== 'risky').length,
    [attachedRows]
  );

  const allAttachedVisibleSelected =
    attachedVisibleIds.length > 0 && attachedVisibleIds.every((id) => selectedAttachedIds.has(id));
  const someAttachedVisibleSelected =
    attachedVisibleIds.length > 0 && attachedVisibleIds.some((id) => selectedAttachedIds.has(id));
  const allUnassignedVisibleSelected =
    unassignedVisibleIds.length > 0 && unassignedVisibleIds.every((id) => selectedUnassignedIds.has(id));
  const someUnassignedVisibleSelected =
    unassignedVisibleIds.length > 0 && unassignedVisibleIds.some((id) => selectedUnassignedIds.has(id));

  function toggleSelected(
    setState: (updater: (prev: Set<string>) => Set<string>) => void,
    leadId: string
  ) {
    setState((prev) => {
      const next = new Set(prev);
      if (next.has(leadId)) next.delete(leadId);
      else next.add(leadId);
      return next;
    });
  }

  function selectAllAttachedVisible() {
    if (isLeadMutationLocked || isMutating) return;
    if (attachedVisibleIds.length === 0) return;
    setSelectedAttachedIds((prev) => {
      const next = new Set(prev);
      for (const id of attachedVisibleIds) {
        next.add(id);
      }
      return next;
    });
  }

  function clearAllAttachedVisible() {
    if (isLeadMutationLocked || isMutating) return;
    if (attachedVisibleIds.length === 0) return;
    setSelectedAttachedIds((prev) => {
      const next = new Set(prev);
      for (const id of attachedVisibleIds) {
        next.delete(id);
      }
      return next;
    });
  }

  function selectAllUnassignedVisible() {
    if (isLeadMutationLocked || isMutating) return;
    if (unassignedVisibleIds.length === 0) return;
    setSelectedUnassignedIds((prev) => {
      const next = new Set(prev);
      for (const id of unassignedVisibleIds) {
        next.add(id);
      }
      return next;
    });
  }

  function clearAllUnassignedVisible() {
    if (isLeadMutationLocked || isMutating) return;
    if (unassignedVisibleIds.length === 0) return;
    setSelectedUnassignedIds((prev) => {
      const next = new Set(prev);
      for (const id of unassignedVisibleIds) {
        next.delete(id);
      }
      return next;
    });
  }

  async function attachSelected() {
    if (isLeadMutationLocked) {
      toast.error(leadMutationLockedMessage);
      return;
    }
    if (isMutating) return;
    const leadIds = Array.from(selectedUnassignedIds);
    if (leadIds.length === 0) return;

    const priorAttached = attachedLeadIdsState;
    const optimisticToAttach = leadIds.filter((id) => !attachedLeadIdSet.has(id));
    if (optimisticToAttach.length > 0) {
      setAttachedLeadIdsState((prev) => Array.from(new Set([...prev, ...optimisticToAttach])));
    }
    setIsMutating(true);

    try {
      const result = await attachLeadsAction(campaign.id, leadIds);
      if (!result.success) {
        setAttachedLeadIdsState(priorAttached);
        toast.error(getMutationErrorMessage(result.error));
        return;
      }
      if (result.inserted > 0) {
        toast.success(
          `Attached ${result.inserted} qualified/risky lead(s) and synced. Existing: ${result.skipped_existing}, ineligible: ${result.skipped_ineligible}, missing: ${result.skipped_missing}, out-of-scope: ${result.skipped_out_of_scope ?? 0}.`
        );
      } else {
        toast(
          `No new qualified/risky leads attached after sync. Existing: ${result.skipped_existing}, ineligible: ${result.skipped_ineligible}, missing: ${result.skipped_missing}, out-of-scope: ${result.skipped_out_of_scope ?? 0}.`,
          { icon: 'ℹ️' }
        );
      }
      setSelectedUnassignedIds(new Set());
      router.refresh();
    } catch (error) {
      setAttachedLeadIdsState(priorAttached);
      toast.error(getMutationErrorMessage(error));
    } finally {
      setIsMutating(false);
    }
  }

  function requestRemoveSelected() {
    if (isLeadMutationLocked) {
      toast.error(leadMutationLockedMessage);
      return;
    }
    const leadIds = Array.from(selectedAttachedIds);
    if (leadIds.length === 0) return;
    setRemoveTargetCount(leadIds.length);
    setRemoveConfirmOpen(true);
  }

  async function removeSelected() {
    if (isLeadMutationLocked) {
      toast.error(leadMutationLockedMessage);
      return;
    }
    if (isMutating) return;
    const leadIds = Array.from(selectedAttachedIds);
    if (leadIds.length === 0) {
      setRemoveConfirmOpen(false);
      return;
    }

    setRemovePending(true);
    const priorAttached = attachedLeadIdsState;
    setAttachedLeadIdsState((prev) => prev.filter((id) => !leadIds.includes(id)));
    setIsMutating(true);

    try {
      const result = await detachLeadsAction(campaign.id, leadIds);
      if (!result.success) {
        setAttachedLeadIdsState(priorAttached);
        toast.error(getMutationErrorMessage(result.error));
        return;
      }
      if (result.detached > 0) {
        toast.success(`Removed ${result.detached} and synced. Missing: ${result.skipped_missing}, out-of-scope: ${result.skipped_out_of_scope ?? 0}.`);
      } else {
        toast(`No leads removed after sync. Missing: ${result.skipped_missing}, out-of-scope: ${result.skipped_out_of_scope ?? 0}.`, { icon: 'ℹ️' });
      }
      setSelectedAttachedIds(new Set());
      setRemoveConfirmOpen(false);
      router.refresh();
    } catch (error) {
      setAttachedLeadIdsState(priorAttached);
      toast.error(getMutationErrorMessage(error));
    } finally {
      setRemovePending(false);
      setIsMutating(false);
    }
  }

  async function attachFromSource() {
    if (isLeadMutationLocked) {
      toast.error(leadMutationLockedMessage);
      return;
    }
    if (isMutating) return;
    if (sourceId === 'all') {
      await attachSelected();
      return;
    }

    if (!selectedFolderId) return;
    const folderScopeIds = candidateScopeLeads
      .filter((lead) => {
        const bucket = classifyLead(lead);
        return bucket === 'valid' || bucket === 'risky';
      })
      .map((lead) => String(lead.id))
      .filter((id) => !attachedLeadIdSet.has(id));
    const priorAttached = attachedLeadIdsState;
    if (folderScopeIds.length > 0) {
      setAttachedLeadIdsState((prev) => Array.from(new Set([...prev, ...folderScopeIds])));
    }
    setIsMutating(true);
    try {
      const result = await attachFolderLeadsAction(campaign.id, [selectedFolderId]);
      if (!result.success) {
        setAttachedLeadIdsState(priorAttached);
        toast.error(getMutationErrorMessage(result.error));
        return;
      }
      if (result.inserted > 0) {
        toast.success(
          `Folder attached: ${result.inserted} qualified/risky lead(s) and synced. Existing: ${result.skipped_existing}, skipped non-attachable: ${result.skipped_ineligible}, missing: ${result.skipped_missing}.`
        );
      } else {
        toast(
          '0 attachable leads attached from this folder after sync. Only qualified/risky (eligible/valid/validated/risky) leads are attachable.',
          { icon: '⚠️' }
        );
      }
      router.refresh();
    } catch (error) {
      setAttachedLeadIdsState(priorAttached);
      toast.error(getMutationErrorMessage(error));
    } finally {
      setIsMutating(false);
    }
  }

  async function attachSingleLead(leadId: string) {
    if (isLeadMutationLocked) {
      toast.error(leadMutationLockedMessage);
      return;
    }
    if (isMutating) return;
    const priorAttached = attachedLeadIdsState;
    if (!attachedLeadIdSet.has(leadId)) {
      setAttachedLeadIdsState((prev) => Array.from(new Set([...prev, leadId])));
    }
    setIsMutating(true);
    try {
      const result = await attachLeadsAction(campaign.id, [leadId]);
      if (!result.success) {
        setAttachedLeadIdsState(priorAttached);
        toast.error(getMutationErrorMessage(result.error));
        return;
      }
      router.refresh();
    } catch (error) {
      setAttachedLeadIdsState(priorAttached);
      toast.error(getMutationErrorMessage(error));
    } finally {
      setIsMutating(false);
    }
  }

  async function detachSingleLead(leadId: string) {
    if (isLeadMutationLocked) {
      toast.error(leadMutationLockedMessage);
      return;
    }
    if (isMutating) return;
    const priorAttached = attachedLeadIdsState;
    setAttachedLeadIdsState((prev) => prev.filter((id) => id !== leadId));
    setIsMutating(true);
    try {
      const result = await detachLeadsAction(campaign.id, [leadId]);
      if (!result.success) {
        setAttachedLeadIdsState(priorAttached);
        toast.error(getMutationErrorMessage(result.error));
        return;
      }
      router.refresh();
    } catch (error) {
      setAttachedLeadIdsState(priorAttached);
      toast.error(getMutationErrorMessage(error));
    } finally {
      setIsMutating(false);
    }
  }

  function onDragStart(leadId: string, source: 'attached' | 'unassigned') {
    if (isLeadMutationLocked || isMutating) return;
    setDraggingLeadId(leadId);
    setDragSource(source);
  }

  async function onDropToColumn(target: 'attached' | 'unassigned') {
    if (isLeadMutationLocked) {
      toast.error(leadMutationLockedMessage);
      setDraggingLeadId(null);
      setDragSource(null);
      return;
    }
    if (isMutating) return;
    if (!draggingLeadId || !dragSource || dragSource === target) return;
    if (dragSource === 'unassigned' && target === 'attached') {
      await attachSingleLead(draggingLeadId);
    }
    if (dragSource === 'attached' && target === 'unassigned') {
      await detachSingleLead(draggingLeadId);
    }
    setDraggingLeadId(null);
    setDragSource(null);
  }

  const attachedCount = attachedRows.length;
  const canLaunchLeads = attachedCount > 0;

  return (
    <div className="border border-border rounded p-4 space-y-4 bg-card">
      {!mutationHealth?.ok ? (
        <div className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          Mutation health check failed: {mutationHealth?.reason ?? 'Route contract mismatch or backend unavailable.'}
          {' '}Verify backend deployment and `NEXT_PUBLIC_API_BASE_URL`.
        </div>
      ) : null}
      {mutationHealth?.ok ? (
        <div className="rounded border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-200">
          Mutation health: OK ({mutationHealth.routeContractVersion ?? 'campaign-mutations-v1'})
        </div>
      ) : null}
      {isLeadMutationLocked ? (
        <div className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          {leadMutationLockedMessage}
        </div>
      ) : null}
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">Campaign Leads</h2>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {isMutating ? (
            <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-primary">
              Updating leads...
            </span>
          ) : null}
          <span>{canLaunchLeads ? 'Ready: campaign leads attached.' : 'Blocked: no attached campaign leads.'}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span>Attached: {attachedCount}</span>
        <span>Qualified: {validCandidates.length}</span>
        <span>Risky (attachable): {riskyCandidates.length}</span>
        <span>Ineligible: {excludedRows.length}</span>
      </div>
      {attachedNonQualifiedCount > 0 ? (
        <div className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          {attachedNonQualifiedCount} attached lead(s) are non-attachable (legacy). Remove them to keep campaign within qualified/risky policy.
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant={activeEligibilityTab === 'eligible' ? 'default' : 'outline'} onClick={() => setActiveEligibilityTab('eligible')}>
          Qualified + Risky ({attachableRows.length})
        </Button>
        <Button size="sm" variant={activeEligibilityTab === 'ineligible' ? 'default' : 'outline'} onClick={() => setActiveEligibilityTab('ineligible')}>
          Ineligible ({excludedRows.length})
        </Button>
        {activeEligibilityTab === 'ineligible' ? (
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            {ineligibleBreakdown.risky > 0 ? <span className="rounded-full border border-border px-2 py-0.5">risky: {ineligibleBreakdown.risky}</span> : null}
            {ineligibleBreakdown.used > 0 ? <span className="rounded-full border border-border px-2 py-0.5">used: {ineligibleBreakdown.used}</span> : null}
            {ineligibleBreakdown.pending > 0 ? <span className="rounded-full border border-border px-2 py-0.5">pending: {ineligibleBreakdown.pending}</span> : null}
            {ineligibleBreakdown.invalid > 0 ? <span className="rounded-full border border-border px-2 py-0.5">invalid: {ineligibleBreakdown.invalid}</span> : null}
            {ineligibleBreakdown.blocked > 0 ? <span className="rounded-full border border-border px-2 py-0.5">blocked: {ineligibleBreakdown.blocked}</span> : null}
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <section
          className="rounded border border-border/60 p-3 bg-background/30 space-y-3"
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => void onDropToColumn('attached')}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Attached ({attachedRows.length})</h3>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={allAttachedVisibleSelected ? clearAllAttachedVisible : selectAllAttachedVisible}
                disabled={isLeadMutationLocked || isMutating || attachedVisibleIds.length === 0}
              >
                {allAttachedVisibleSelected ? 'Clear all' : 'Select all'}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={requestRemoveSelected}
                disabled={isLeadMutationLocked || isMutating || selectedAttachedIds.size === 0}
              >
                Remove Selected
              </Button>
            </div>
          </div>
          {someAttachedVisibleSelected && !allAttachedVisibleSelected ? (
            <div className="text-[11px] text-muted-foreground">Some visible leads selected.</div>
          ) : null}
          <input
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            placeholder="Search attached..."
            value={attachedSearch}
            onChange={(e) => setAttachedSearch(e.target.value)}
          />
          <div className="max-h-[360px] overflow-auto space-y-2">
            {attachedVisible.length === 0 && (
              <div className="text-xs text-muted-foreground py-4 text-center">No attached leads in this view.</div>
            )}
            {attachedVisible.map((row) => (
              <label
                key={row.id}
                draggable={!isLeadMutationLocked && !isMutating}
                onDragStart={() => onDragStart(row.id, 'attached')}
                className={`flex items-center gap-2 rounded p-2 bg-muted/20 text-sm ${isLeadMutationLocked || isMutating ? 'cursor-not-allowed opacity-70' : 'cursor-grab'}`}
              >
                <input
                  type="checkbox"
                  checked={selectedAttachedIds.has(row.id)}
                  onChange={() => toggleSelected(setSelectedAttachedIds, row.id)}
                  disabled={isLeadMutationLocked || isMutating}
                />
                  <span className="flex-1 truncate">{row.email}</span>
                <span className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  {row.freeProvider ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-primary">
                      <span className="h-2 w-2 rounded-full bg-primary" title="Free provider" />
                      free
                    </span>
                  ) : null}
                  {row.bucket === 'valid' ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-1.5 py-0.5 text-emerald-300">
                      <span className="h-2 w-2 rounded-full bg-emerald-400" title="Qualified" />
                      qualified
                    </span>
                  ) : null}
                  {row.bucket === 'risky' ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-500/10 px-1.5 py-0.5 text-amber-300">
                      <span className="h-2 w-2 rounded-full bg-amber-400" title="Risky" />
                      risky
                    </span>
                  ) : null}
                  {row.bucket !== 'valid' && row.bucket !== 'risky' ? bucketLabel(row.bucket) : null}
                  {row.source === 'orphan' ? ' · orphan' : null}
                </span>
              </label>
            ))}
          </div>
        </section>

        <section
          className="rounded border border-border/60 p-3 bg-background/30 space-y-3"
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => void onDropToColumn('unassigned')}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">
              {activeEligibilityTab === 'eligible' ? `Qualified + Risky (${attachableRows.length})` : `Ineligible (${excludedRows.length})`}
            </h3>
            {activeEligibilityTab === 'eligible' ? (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={allUnassignedVisibleSelected ? clearAllUnassignedVisible : selectAllUnassignedVisible}
                  disabled={isLeadMutationLocked || isMutating || unassignedVisibleIds.length === 0}
                >
                  {allUnassignedVisibleSelected ? 'Clear all' : 'Select all'}
                </Button>
                <Button
                  size="sm"
                  onClick={attachSelected}
                  disabled={isLeadMutationLocked || isMutating || selectedUnassignedIds.size === 0}
                >
                  Attach Selected
                </Button>
              </div>
            ) : null}
          </div>
          {activeEligibilityTab === 'eligible' && someUnassignedVisibleSelected && !allUnassignedVisibleSelected ? (
            <div className="text-[11px] text-muted-foreground">Some visible leads selected.</div>
          ) : null}
          <input
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            placeholder={activeEligibilityTab === 'eligible' ? 'Search qualified/risky...' : 'Search ineligible...'}
            value={activeEligibilityTab === 'eligible' ? eligibleSearch : ineligibleSearch}
            onChange={(e) => {
              if (activeEligibilityTab === 'eligible') setEligibleSearch(e.target.value);
              else setIneligibleSearch(e.target.value);
            }}
          />
          <div className="max-h-[360px] overflow-auto space-y-2">
            {activeEligibilityTab === 'eligible' && unassignedVisible.length === 0 ? (
              <div className="text-xs text-muted-foreground py-4 text-center">No qualified/risky unassigned leads.</div>
            ) : null}
            {activeEligibilityTab === 'eligible' ? unassignedVisible.map((lead) => {
              const bucket = classifyLead(lead);
              const id = String(lead.id);
              return (
                <label
                  key={id}
                  draggable={!isLeadMutationLocked && !isMutating}
                  onDragStart={() => onDragStart(id, 'unassigned')}
                  className={`flex items-center gap-2 rounded p-2 bg-muted/20 text-sm ${isLeadMutationLocked || isMutating ? 'cursor-not-allowed opacity-70' : 'cursor-grab'}`}
                >
                  <input
                    type="checkbox"
                    checked={selectedUnassignedIds.has(id)}
                    onChange={() => toggleSelected(setSelectedUnassignedIds, id)}
                    disabled={isLeadMutationLocked || isMutating}
                  />
                  <span className="flex-1 truncate">{String(lead.email ?? `Unknown lead ${id}`)}</span>
                  <span className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    {isFreeProvider(lead) ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-primary">
                        <span className="h-2 w-2 rounded-full bg-primary" title="Free provider" />
                        free
                      </span>
                    ) : null}
                    {bucket === 'valid' ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-1.5 py-0.5 text-emerald-300">
                        <span className="h-2 w-2 rounded-full bg-emerald-400" title="Qualified" />
                        qualified
                      </span>
                    ) : null}
                    {bucket === 'risky' ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-500/10 px-1.5 py-0.5 text-amber-300">
                        <span className="h-2 w-2 rounded-full bg-amber-400" title="Risky" />
                        risky
                      </span>
                    ) : null}
                  </span>
                </label>
              );
            }) : null}
            {activeEligibilityTab === 'ineligible' && excludedVisible.length === 0 ? (
              <div className="text-xs text-muted-foreground py-4 text-center">No ineligible leads.</div>
            ) : null}
            {activeEligibilityTab === 'ineligible' ? excludedVisible.map((lead) => {
              const bucket = classifyLead(lead);
              const reason = String(lead.email_eligibility_reason ?? '').trim();
              return (
                <div
                  key={String(lead.id)}
                  className="rounded p-2 bg-muted/20 text-sm space-y-1"
                  title={reason || bucketLabel(bucket)}
                >
                  <div className="truncate">{String(lead.email ?? `Unknown lead ${lead.id}`)}</div>
                  <div className="text-[10px] text-muted-foreground">
                    <span className="font-medium">{bucketLabel(bucket)}</span>
                    {reason ? ` · ${reason}` : ' · no reason provided'}
                  </div>
                </div>
              );
            }) : null}
          </div>
          {activeEligibilityTab === 'ineligible' && excludedVisibleIds.length > 0 ? (
            <div className="text-[11px] text-muted-foreground">
              Ineligible leads are visible for review only and cannot be attached.
            </div>
          ) : null}
        </section>
      </div>

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label className="text-xs text-muted-foreground">
            Lead source
          </label>
          <select
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            value={sourceId}
            onChange={(e) => setSourceId(e.target.value)}
          >
            <option value="all">Global (All Leads)</option>
            {leadFolders.map((folder) => (
              <option key={folder.id} value={`folder:${folder.id}`}>
                Folder: {folder.name} {folder.lead_count != null ? `(${folder.lead_count})` : ''}
              </option>
            ))}
          </select>
        </div>
        <Button
          variant="outline"
          onClick={attachFromSource}
          disabled={
            isLeadMutationLocked ||
            isMutating ||
            (sourceId === 'all'
              ? selectedUnassignedIds.size === 0 || activeEligibilityTab !== 'eligible'
              : !selectedFolderId)
          }
        >
          Attach Source
        </Button>
      </div>

      {removeConfirmOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="remove-attached-leads-title"
        >
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-xl space-y-4">
            <h3 id="remove-attached-leads-title" className="text-base font-semibold">
              Confirm removal
            </h3>
            <p className="text-sm text-muted-foreground">
              Remove {removeTargetCount} attached lead(s) from this campaign?
            </p>
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setRemoveConfirmOpen(false)}
                disabled={removePending || isMutating}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => void removeSelected()}
                disabled={removePending || isMutating}
              >
                {removePending ? 'Removing...' : 'Remove'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
