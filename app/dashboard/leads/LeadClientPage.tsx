'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import * as ToggleGroup from '@radix-ui/react-toggle-group';
import { AlertTriangle, CheckCircle, Clock, Database, Filter, Folder, FolderOpen, UploadCloud } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { cn } from '@/lib/utils';

import DynamicTable from '@/components/dynamic/dynamicTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RunValidationButton } from '@/components/buttton/RunValidationButton';
import {
  assignLeadsToFolderAction,
  createLeadFolderAction,
  deleteLeadsBulkAction,
  forceUnlockAndRerunAction,
  resetStuckAndRerunAction,
  getValidationRunStatusAction,
  rerunFailedValidationAction,
  runEmailValidationAction,
  type LeadFolder,
  type ValidationRunStatusResponse,
} from './actions';
const LEADS_SCOPE_STORAGE_KEY = 'obaol_leads_scope_v1';

type Props = {
  leads: any[];
  relations: any;
  role?: string;
  initialFolders: LeadFolder[];
};

type LeadView = 'all' | 'validated' | 'pending' | 'risky' | 'blocked' | 'used' | 'free';
type LeadScope = { type: 'all' } | { type: 'folder'; folderId: string };

function detectLifecycle(lead: any) {
  if (lead.email_eligibility === 'blocked' || lead.is_blocked) return 'blocked';
  if (lead.validation_status === 'valid' || lead.validation_status === 'validated' || lead.email_eligibility === 'eligible') return 'validated';
  if (lead.validation_status === 'risky' || lead.email_eligibility === 'risky') return 'risky';
  if (lead.email_eligibility === 'pending' || lead.eligibility_processing) return 'pending';
  return lead.lead_status || 'raw_imported';
}

export default function LeadsClientPage({ leads, relations, role, initialFolders }: Props) {
  const [view, setView] = useState<LeadView>('all');
  const [providerFilter, setProviderFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [riskMax, setRiskMax] = useState('');
  const [validationStatus, setValidationStatus] = useState<ValidationRunStatusResponse | null>(null);
  const [validationLoading, setValidationLoading] = useState(true);
  const [folders, setFolders] = useState<LeadFolder[]>(initialFolders ?? []);
  const [newFolderName, setNewFolderName] = useState('');
  const [folderSelection, setFolderSelection] = useState('');
  const [scope, setScope] = useState<LeadScope>(
    (initialFolders?.length ?? 0) > 0 ? { type: 'folder', folderId: initialFolders[0].id } : { type: 'all' }
  );
  const [folderBusy, setFolderBusy] = useState(false);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [showTableFilters, setShowTableFilters] = useState(true);

  function persistScope(nextScope: LeadScope) {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(LEADS_SCOPE_STORAGE_KEY, JSON.stringify(nextScope));
    } catch {
      // ignore storage failures
    }
  }

  function updateScope(nextScope: LeadScope) {
    setScope(nextScope);
    persistScope(nextScope);
  }

  const providers = useMemo(
    () => Array.from(new Set(leads.map((l) => l.provider).filter(Boolean))),
    [leads]
  );

  const sources = useMemo(
    () => Array.from(new Set(leads.map((l) => l.source).filter(Boolean))),
    [leads]
  );

  async function refreshValidationStatus() {
    try {
      const data = await getValidationRunStatusAction();
      setValidationStatus(data);
    } catch {
      // noop: keep previous snapshot
    } finally {
      setValidationLoading(false);
    }
  }

  useEffect(() => {
    void refreshValidationStatus();
  }, []);

  useEffect(() => {
    const interval = setInterval(
      () => void refreshValidationStatus(),
      validationStatus?.status === 'running' || validationStatus?.status === 'queued' ? 6000 : 20000
    );
    return () => clearInterval(interval);
  }, [validationStatus?.status]);

  useEffect(() => {
    if (scope.type !== 'folder') return;
    setFolderSelection(scope.folderId);
  }, [scope]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(LEADS_SCOPE_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as LeadScope;
      if (parsed.type === 'all') {
        setScope({ type: 'all' });
        return;
      }
      if (parsed.type === 'folder') {
        const exists = folders.some((folder) => folder.id === parsed.folderId);
        if (exists) {
          setScope({ type: 'folder', folderId: parsed.folderId });
        }
      }
    } catch {
      // ignore bad persisted state
    }
  }, [folders]);

  const scopeLeads = useMemo(() => {
    if (scope.type === 'all') return leads;
    return leads.filter((lead) => lead.folder_id === scope.folderId);
  }, [leads, scope]);

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const lifecycle = detectLifecycle(lead);

      if (view === 'validated' && lifecycle !== 'validated') return false;
      if (view === 'pending' && lifecycle !== 'pending') return false;
      if (view === 'risky' && lifecycle !== 'risky') return false;
      if (view === 'blocked' && lifecycle !== 'blocked') return false;
      if (view === 'used' && lead.is_used !== true) return false;
      if (view === 'free' && (lead.is_used === true || lead.is_blocked === true)) return false;

      if (providerFilter && lead.provider !== providerFilter) return false;
      if (sourceFilter && lead.source !== sourceFilter) return false;
      if (scope.type === 'folder' && lead.folder_id !== scope.folderId) return false;

      if (riskMax) {
        const max = Number(riskMax);
        const score = Number(lead.risk_score ?? 0);
        if (!Number.isNaN(max) && score > max) return false;
      }

      return true;
    });
  }, [leads, providerFilter, riskMax, scope, sourceFilter, view]);

  const kpis = useMemo(() => {
    const validated = scopeLeads.filter((l) => detectLifecycle(l) === 'validated').length;
    const invalid = scopeLeads.filter((l) => l.validation_status === 'invalid' || l.email_eligibility === 'invalid').length;
    const pending = scopeLeads.filter((l) => detectLifecycle(l) === 'pending').length;
    const blocked = scopeLeads.filter((l) => detectLifecycle(l) === 'blocked').length;
    const used = scopeLeads.filter((l) => l.is_used).length;
    const free = scopeLeads.filter((l) => !l.is_used && !l.is_blocked).length;
    const emails = scopeLeads.map((l) => String(l.email ?? '').toLowerCase()).filter(Boolean);
    const uniqueEmails = new Set(emails);
    const duplicate = Math.max(0, emails.length - uniqueEmails.size);

    return {
      total: scopeLeads.length,
      validated,
      invalid,
      pending,
      blocked,
      used,
      free,
      duplicate,
    };
  }, [scopeLeads]);

  const hasActiveRun = validationStatus?.status === 'running' || validationStatus?.status === 'queued';
  const pendingAvailable = validationStatus?.availability?.pendingAvailable ?? 0;
  const processingNow = validationStatus?.availability?.processingNow ?? 0;
  const stuckProcessing = validationStatus?.availability?.stuckProcessing ?? 0;
  const recentUpdates = validationStatus?.availability?.recentUpdates ?? 0;
  const runAgeSeconds = validationStatus?.availability?.runAgeSeconds ?? 0;
  const runAgeMinutes = Math.max(0, Math.floor(runAgeSeconds / 60));
  const topReasons = validationStatus?.availability?.topReasons ?? [];
  const mostFailedStep = validationStatus?.availability?.mostFailedStep;
  const showFreshPendingHint =
    !hasActiveRun &&
    validationStatus?.status === 'completed' &&
    (validationStatus?.metrics.totalTargeted ?? 0) === 0 &&
    pendingAvailable > 0;
  const showStalledWarning = hasActiveRun && processingNow > 0 && recentUpdates === 0 && runAgeSeconds >= 120;
  const canResetStuck = showStalledWarning || stuckProcessing > 0 || (hasActiveRun && processingNow === 0 && recentUpdates === 0);
  const canForceUnlock = hasActiveRun && (showStalledWarning || stuckProcessing > 0 || (processingNow === 0 && recentUpdates === 0));
  const activeRunLockReason = hasActiveRun
    ? (processingNow === 0 && recentUpdates === 0
      ? 'Validation process is finalizing. If this persists, use reset to restart cleanly.'
      : 'Validation process is currently processing leads.')
    : null;

  async function handleCreateFolder() {
    const name = newFolderName.trim();
    if (!name) return;
    setFolderBusy(true);
    try {
      const res = await createLeadFolderAction(name);
      setFolders((prev) => [...prev, res.folder].sort((a, b) => a.name.localeCompare(b.name)));
      if (scope.type === 'all') {
        updateScope({ type: 'folder', folderId: res.folder.id });
      }
      setNewFolderName('');
      toast.success('Folder created');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create folder');
    } finally {
      setFolderBusy(false);
    }
  }

  async function handleAssignFilteredToFolder() {
    if (!folderSelection) {
      toast.error('Choose a folder first');
      return;
    }
    const leadIds = filteredLeads.map((lead) => lead.id).filter(Boolean);
    if (leadIds.length === 0) {
      toast.error('No leads in current filter to assign');
      return;
    }
    setFolderBusy(true);
    try {
      await assignLeadsToFolderAction(folderSelection, leadIds);
      toast.success(`Assigned ${leadIds.length} leads to folder`);
      window.location.reload();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to assign leads to folder');
    } finally {
      setFolderBusy(false);
    }
  }

  async function handleAssignSelectedToFolder() {
    if (!folderSelection) {
      toast.error('Choose a folder first');
      return;
    }
    const leadIds = Array.from(new Set(selectedLeadIds)).filter(Boolean);
    if (leadIds.length === 0) {
      toast.error('No selected leads to assign');
      return;
    }
    setFolderBusy(true);
    try {
      await assignLeadsToFolderAction(folderSelection, leadIds);
      toast.success(`Assigned ${leadIds.length} selected leads to folder`);
      window.location.reload();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to assign selected leads');
    } finally {
      setFolderBusy(false);
    }
  }

  async function handleDeleteSelectedLeads() {
    const leadIds = Array.from(new Set(selectedLeadIds)).filter(Boolean);
    if (leadIds.length === 0) {
      toast.error('No selected leads to delete');
      return;
    }
    const shouldDelete = window.confirm(`Delete ${leadIds.length} selected leads? This cannot be undone.`);
    if (!shouldDelete) return;

    setFolderBusy(true);
    try {
      const result = await deleteLeadsBulkAction(leadIds);
      toast.success(`Deleted ${result.deletedCount} selected lead(s)`);
      window.location.reload();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete selected leads');
    } finally {
      setFolderBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 pb-8 max-w-[1600px] mx-auto">
      {/* KPI Dashboard */}
      <section className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-4">
        <KpiCard label="Total Imported" value={kpis.total} icon={<Database className="w-4 h-4 text-primary" />} color="gold" />
        <KpiCard label="Valid" value={kpis.validated} icon={<CheckCircle className="w-4 h-4 text-green-700 dark:text-green-400" />} color="green" />
        <KpiCard label="Invalid" value={kpis.invalid} icon={<AlertTriangle className="w-4 h-4 text-red-700 dark:text-red-400" />} color="red" />
        <KpiCard label="Duplicate" value={kpis.duplicate} icon={<Filter className="w-4 h-4 text-yellow-700 dark:text-yellow-400" />} color="yellow" />
        <KpiCard label="Pending" value={kpis.pending} icon={<Clock className="w-4 h-4 text-primary" />} color="gold" />
        <KpiCard label="Blocked" value={kpis.blocked} icon={<AlertTriangle className="w-4 h-4 text-orange-700 dark:text-orange-400" />} color="orange" />
        <KpiCard label="Used" value={kpis.used} icon={<CheckCircle className="w-4 h-4 text-gray-400" />} color="gray" />
        <KpiCard label="Free" value={kpis.free} icon={<Database className="w-4 h-4 text-teal-400" />} color="teal" />
      </section>

      {/* Lead Folders & Management */}
      <section className="rounded-3xl border border-border/40 bg-card/20 backdrop-blur-xl p-6 shadow-2xl space-y-6 relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-teal-500/50 via-primary/50 to-teal-500/50 opacity-50" />
        
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-8">
          <div className="space-y-1">
            <h3 className="text-2xl font-black tracking-tighter flex items-center gap-3 text-foreground">
              <Database className="h-6 w-6 text-teal-400" /> Lead Ecosystem
            </h3>
            <p className="text-sm text-muted-foreground max-w-md">Organize your leads into specialized folders for targeted campaign orchestration.</p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Input
                placeholder="New Folder Identifier"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                className="h-12 bg-background/40 border-border/60 focus:border-teal-500/50 rounded-xl px-4 text-sm font-medium shadow-inner"
              />
            </div>
            <Button 
              onClick={() => void handleCreateFolder()} 
              disabled={folderBusy || !newFolderName.trim()} 
              className="h-12 px-6 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs uppercase tracking-widest shadow-lg shadow-teal-500/20 transition-all hover:scale-[1.02]"
            >
              Initialize Folder
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Active Directory</div>
            <div className="h-px flex-1 bg-border/40" />
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              className={cn(
                "group relative h-10 rounded-xl border pl-3 pr-4 text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-0",
                scope.type === 'all'
                  ? "border-primary/35 bg-primary/10 text-primary"
                  : "border-border/60 bg-background/25 text-muted-foreground hover:border-primary/25 hover:bg-primary/5 hover:text-foreground"
              )}
              onClick={() => updateScope({ type: 'all' })}
            >
              <span
                className={cn(
                  "pointer-events-none absolute -top-[1px] left-3 h-2.5 w-5 rounded-t-md border border-b-0",
                  scope.type === 'all'
                    ? "border-primary/35 bg-primary/10"
                    : "border-border/60 bg-background/25 group-hover:border-primary/25 group-hover:bg-primary/5"
                )}
                aria-hidden
              />
              {scope.type === 'all' && <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r bg-primary/70" aria-hidden />}
              <FolderOpen className={cn("mr-2 h-3.5 w-3.5", scope.type === 'all' ? "text-primary/90" : "text-muted-foreground")} />
              Global View ({leads.length})
            </Button>
            {folders.map((folder) => (
              <Button
                key={folder.id}
                variant="outline"
                className={cn(
                  "group relative h-10 rounded-xl border pl-3 pr-4 text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors focus-visible:ring-2 focus-visible:ring-teal-400/40 focus-visible:ring-offset-0",
                  scope.type === 'folder' && scope.folderId === folder.id
                    ? "border-teal-400/35 bg-teal-500/10 text-teal-100"
                    : "border-border/60 bg-background/25 text-muted-foreground hover:border-teal-400/25 hover:bg-teal-500/5 hover:text-foreground"
                )}
                onClick={() => updateScope({ type: 'folder', folderId: folder.id })}
              >
                <span
                  className={cn(
                    "pointer-events-none absolute -top-[1px] left-3 h-2.5 w-5 rounded-t-md border border-b-0",
                    scope.type === 'folder' && scope.folderId === folder.id
                      ? "border-teal-400/35 bg-teal-500/10"
                      : "border-border/60 bg-background/25 group-hover:border-teal-400/25 group-hover:bg-teal-500/5"
                  )}
                  aria-hidden
                />
                {scope.type === 'folder' && scope.folderId === folder.id && (
                  <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r bg-teal-300/80" aria-hidden />
                )}
                <Folder className={cn("mr-2 h-3.5 w-3.5", scope.type === 'folder' && scope.folderId === folder.id ? "text-teal-200" : "text-muted-foreground")} />
                {folder.name} ({folder.lead_count})
              </Button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 pt-5 border-t border-border/40">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Bulk Folder Assignment</label>
              {selectedLeadIds.length > 0 && (
                <span className="text-[10px] font-black uppercase tracking-widest text-primary animate-pulse">
                  {selectedLeadIds.length} Selected
                </span>
              )}
            </div>
            <div className="flex gap-3">
              <select
                className="flex-1 h-12 rounded-xl border border-border/60 bg-background/40 px-4 text-sm font-medium focus:ring-2 focus:ring-primary/20 outline-none transition-all shadow-inner"
                value={folderSelection}
                onChange={(e) => setFolderSelection(e.target.value)}
              >
                <option value="">Target Folder...</option>
                {folders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name}
                  </option>
                ))}
              </select>
              <Button
                variant="outline"
                onClick={() => void handleAssignFilteredToFolder()}
                disabled={folderBusy || !folderSelection || filteredLeads.length === 0}
                className="h-12 px-6 rounded-xl border-primary/20 hover:bg-primary/10 hover:text-primary font-bold text-[10px] uppercase tracking-widest transition-all"
              >
                Assign {filteredLeads.length} leads
              </Button>
            </div>
          </div>

          <div className="flex items-end gap-3">
            <Button
              variant="outline"
              onClick={() => void handleAssignSelectedToFolder()}
              disabled={folderBusy || !folderSelection || selectedLeadIds.length === 0}
              className="flex-1 h-12 rounded-xl border-teal-500/20 hover:bg-teal-500/10 hover:text-teal-400 font-bold text-[10px] uppercase tracking-widest transition-all"
            >
              Assign Selected
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleDeleteSelectedLeads()}
              disabled={folderBusy || selectedLeadIds.length === 0}
              className="flex-1 h-12 rounded-xl font-bold text-[10px] uppercase tracking-widest shadow-lg shadow-destructive/10 transition-all hover:scale-[1.02]"
            >
              Purge Selected
            </Button>
          </div>
        </div>
      </section>

      {/* Main Controls */}
      <div className="space-y-4">
        <section className="rounded-2xl border border-border/40 bg-card/30 backdrop-blur-md p-5 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/30 via-primary/80 to-primary/30" />
          <div className="space-y-4">
            <h3 className="text-xl font-bold tracking-tight flex items-center gap-2 text-foreground">
              <UploadCloud className="h-5 w-5 text-primary" /> Bulk Upload
            </h3>
            <p className="text-sm text-muted-foreground max-w-xl">
              Import workflow has moved to a dedicated page for cleaner lead operations and better focus.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/dashboard/leads/upload"
                className="inline-flex h-11 items-center rounded-xl bg-primary px-5 text-xs font-bold uppercase tracking-widest text-primary-foreground transition-all hover:scale-[1.02] hover:opacity-90"
              >
                Open Bulk Upload
              </Link>
              <span className="text-[11px] text-muted-foreground">
                CSV/XLSX mapping, preview, and import report are available there.
              </span>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-4 items-start">
          <section className="rounded-2xl border border-border/40 bg-card/30 backdrop-blur-md p-5 shadow-xl">
            <div className="mb-4 flex flex-col">
              <h3 className="text-lg font-bold tracking-tight flex items-center gap-2 text-foreground">
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" /> Validation
              </h3>
              <p className="text-xs text-muted-foreground mt-1">Manage pipeline checks.</p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5 items-start">
              <div className="lg:col-span-8 rounded-xl border border-border/40 bg-background/30 p-3 space-y-2">
                {validationLoading ? (
                  <div className="text-xs text-muted-foreground">Loading validation status...</div>
                ) : (
                  <>
                    <div className="flex items-center justify-between text-xs">
                      <span className="uppercase tracking-wider text-muted-foreground">Status</span>
                      <span className="font-semibold text-foreground">{validationStatus?.status ?? 'idle'}</span>
                    </div>
                    {!hasActiveRun && (
                      <div className="text-xs rounded-md border border-emerald-500/20 bg-emerald-500/5 p-2 text-emerald-300">
                        Pending available: <span className="font-semibold">{pendingAvailable}</span>
                      </div>
                    )}
                    <div className="w-full h-2 rounded bg-muted overflow-hidden">
                      <div
                        className="h-full bg-green-500 transition-all duration-500"
                        style={{ width: `${hasActiveRun ? validationStatus?.metrics.completionPercent ?? 0 : pendingAvailable > 0 ? 100 : 0}%` }}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] leading-4 text-muted-foreground">
                      <div>Targeted: <span className="text-foreground">{validationStatus?.metrics.totalTargeted ?? 0}</span></div>
                      <div>Processed: <span className="text-foreground">{validationStatus?.metrics.processed ?? 0}</span></div>
                      <div>Remaining: <span className="text-foreground">{validationStatus?.metrics.remaining ?? 0}</span></div>
                      <div>Done: <span className="text-foreground">{validationStatus?.metrics.completionPercent ?? 0}%</span></div>
                      <div>Processing now: <span className="text-foreground">{validationStatus?.availability?.processingNow ?? 0}</span></div>
                      <div>Stuck processing: <span className="text-foreground">{validationStatus?.availability?.stuckProcessing ?? 0}</span></div>
                      <div>Updated in last 2 min: <span className="text-foreground">{validationStatus?.availability?.recentUpdates ?? 0}</span></div>
                      <div>Total leads: <span className="text-foreground">{validationStatus?.availability?.totalLeads ?? 0}</span></div>
                    </div>
                    <div className="rounded-md border border-border/40 bg-background/20 p-2 text-[10px] leading-4 text-muted-foreground space-y-1">
                      <div><span className="text-foreground">Step 1</span> syntax check.</div>
                      <div><span className="text-foreground">Step 2</span> provider/domain check.</div>
                      <div><span className="text-foreground">Step 3</span> risk filters (free provider, role-based, disposable).</div>
                      <div><span className="text-foreground">Step 4</span> final eligibility decision.</div>
                    </div>
                    {mostFailedStep && mostFailedStep.count > 0 && (
                      <div className="text-[10px] leading-4 text-amber-700 dark:text-amber-300">
                        Most failures at: <span className="text-foreground">{mostFailedStep.label}</span> ({mostFailedStep.count})
                      </div>
                    )}
                    {topReasons.length > 0 && (
                      <div className="text-[10px] leading-4 text-muted-foreground">
                        Top reasons: {topReasons.slice(0, 3).map((row) => `${row.reason} (${row.count})`).join(' · ')}
                      </div>
                    )}
                    {showStalledWarning && (
                      <div className="text-[10px] leading-4 text-amber-700 dark:text-amber-400">
                        Validation appears stalled. Last progress: {runAgeMinutes} min ago. {processingNow} in progress, {stuckProcessing} stale candidates.
                      </div>
                    )}
                    {validationStatus?.availability?.lastProgressAt && (
                      <div className="text-[10px] leading-4 text-muted-foreground">
                        Last progress at: {new Date(validationStatus.availability.lastProgressAt).toLocaleString()}
                      </div>
                    )}
                    {validationStatus?.availability?.lastProcessedLeadAt && (
                      <div className="text-[10px] leading-4 text-muted-foreground">
                        Last processed lead update: {new Date(validationStatus.availability.lastProcessedLeadAt).toLocaleString()}
                      </div>
                    )}
                    {showFreshPendingHint && (
                      <div className="text-[10px] leading-4 text-emerald-300">
                        New pending leads are available for validation.
                      </div>
                    )}
                    {!showFreshPendingHint && validationStatus?.status === 'completed' && (validationStatus?.metrics.totalTargeted ?? 0) === 0 && (
                      <div className="text-[10px] leading-4 text-amber-700 dark:text-amber-400">
                        No queue-eligible pending leads matched current backend filters (pending + not processing).
                      </div>
                    )}
                  </>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-[10px] px-2"
                  onClick={() => void refreshValidationStatus()}
                >
                  Refresh Status
                </Button>
              </div>
              <div className="lg:col-span-4 flex flex-col gap-2.5">
                {activeRunLockReason && (
                  <div className="text-[10px] leading-4 rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-amber-700 dark:text-amber-300">
                    {activeRunLockReason}
                  </div>
                )}
                <RunValidationButton
                  label="Run Email Validation"
                  successText="Validation pipeline started"
                  onRun={runEmailValidationAction}
                  disabled={validationStatus?.status === 'running' || validationStatus?.status === 'queued'}
                  disabledText="A validation run is currently active."
                />
                <RunValidationButton
                  label="Re-run Failed"
                  successText="Failed leads queued again"
                  onRun={rerunFailedValidationAction}
                  disabled={validationStatus?.status === 'running' || validationStatus?.status === 'queued'}
                  disabledText="A validation run is currently active."
                />
                <RunValidationButton
                  label="Reset Stuck & Re-run"
                  successText="In-progress rows reset and validation restarted"
                  onRun={async () => {
                    const result = await resetStuckAndRerunAction();
                    await refreshValidationStatus();
                    return result;
                  }}
                  disabled={!canResetStuck}
                  disabledText="Reset is available when run has stalled or no rows are progressing."
                />
                {canForceUnlock && (
                  <RunValidationButton
                    label="Force Unlock & Re-run"
                    successText="Stale run unlocked and validation restarted"
                    onRun={async () => {
                      const result = await forceUnlockAndRerunAction();
                      await refreshValidationStatus();

                      const previous = result.previousRunId ? `Closed ${result.previousRunId}` : 'No prior run id';
                      const next = result.newRunId ?? result.runId;
                      toast.success(`${previous} -> Started ${next}`);

                      return result;
                    }}
                  />
                )}
                <Button variant="outline" className="w-full justify-start border-primary/20 hover:bg-primary/10 hover:text-primary font-bold text-xs" onClick={() => alert('Use filtered Validated view as campaign-ready pool.')}>
                  Prepare Campaign Pool
                </Button>
                {(role === 'admin' || role === 'superadmin') && (
                  <Link
                    href="/dashboard/admin/validation-monitor"
                    className="inline-flex w-full items-center justify-start rounded-md border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    Open Validation Monitor (Admin)
                  </Link>
                )}
              </div>
            </div>
          </section>

        </div>
      </div>

      <section className="rounded-2xl border border-border/40 bg-card/20 backdrop-blur-sm p-4 shadow-xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-black uppercase tracking-wider text-foreground flex items-center gap-2">
              <Filter className="h-4 w-4 text-primary" /> Table Filters
            </h3>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-[10px] font-bold uppercase tracking-widest"
              onClick={() => {
                setView('all');
                setProviderFilter('');
                setSourceFilter('');
                setRiskMax('');
              }}
            >
              Clear Filters
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-[10px] font-bold uppercase tracking-widest"
            onClick={() => setShowTableFilters((prev) => !prev)}
          >
            {showTableFilters ? 'Hide Filters' : 'Show Filters'}
          </Button>
        </div>

        {showTableFilters && (
          <>
            <ToggleGroup.Root
              type="single"
              value={view}
              onValueChange={(v) => v && setView(v as LeadView)}
              className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2"
            >
              <ToggleItem value="all" label="All" />
              <ToggleItem value="validated" label="Valid" />
              <ToggleItem value="pending" label="Pending" />
              <ToggleItem value="risky" label="Risky" />
              <ToggleItem value="blocked" label="Blocked" />
              <ToggleItem value="used" label="Used" />
              <ToggleItem value="free" label="Free" />
            </ToggleGroup.Root>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Provider</label>
                <select className="w-full h-10 rounded-xl border border-border/60 bg-background/40 px-3 text-xs font-medium focus:ring-2 focus:ring-primary/20 outline-none transition-all shadow-inner" value={providerFilter} onChange={(e) => setProviderFilter(e.target.value)}>
                  <option value="">All Providers</option>
                  {providers.map((provider) => (
                    <option key={provider} value={provider}>{provider}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Source</label>
                <select className="w-full h-10 rounded-xl border border-border/60 bg-background/40 px-3 text-xs font-medium focus:ring-2 focus:ring-primary/20 outline-none transition-all shadow-inner" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
                  <option value="">All Sources</option>
                  {sources.map((source) => (
                    <option key={source} value={source}>{source}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Risk Max</label>
                <div className="relative">
                  <Input placeholder="e.g. 30" value={riskMax} onChange={(e) => setRiskMax(e.target.value)} className="h-10 bg-background/40 border-border/60 rounded-xl px-4 text-xs font-medium shadow-inner" />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-bold text-muted-foreground uppercase">MAX</div>
                </div>
              </div>
            </div>
          </>
        )}
      </section>

      <div className="rounded-2xl border border-border/40 bg-card/20 backdrop-blur-sm p-1 shadow-2xl overflow-hidden">
        <DynamicTable
          table="leads"
          data={filteredLeads}
          role={role}
          relations={relations}
          bulkFolderOptions={folders.map((folder) => ({ id: folder.id, name: folder.name }))}
          onBulkAssignFolder={(ids, folderId) => assignLeadsToFolderAction(folderId, ids)}
          onSelectionChange={setSelectedLeadIds}
          onFilterToggle={() => setShowTableFilters((prev) => !prev)}
          showFilterButton
          exportFilename="leads"
        />
      </div>
    </div>
  );
}

function KpiCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  const colorMap: Record<string, string> = {
    gold: "from-primary/20 to-transparent border-primary/30",
    green: "from-green-500/20 to-transparent border-green-500/30",
    red: "from-red-500/20 to-transparent border-red-500/30",
    yellow: "from-yellow-500/20 to-transparent border-yellow-500/30",
    orange: "from-orange-500/20 to-transparent border-orange-500/30",
    gray: "from-gray-500/20 to-transparent border-gray-500/30",
    teal: "from-teal-500/20 to-transparent border-teal-500/30",
  };

  return (
    <div className={cn(
      "group relative rounded-2xl border bg-card/40 backdrop-blur-md p-4 transition-all duration-500 hover:scale-[1.03] hover:shadow-2xl overflow-hidden",
      colorMap[color] || "border-border/40"
    )}>
      <div className={cn("absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-500", colorMap[color])} />
      <div className="relative z-10 flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground group-hover:text-foreground transition-colors">{label}</span>
          <div className="opacity-40 group-hover:opacity-100 group-hover:scale-110 transition-all duration-500">
            {icon}
          </div>
        </div>
        <span className="text-2xl font-black tracking-tighter text-foreground mt-1">{value.toLocaleString()}</span>
      </div>
    </div>
  );
}

function ToggleItem({ value, label }: { value: string; label: string }) {
  return (
    <ToggleGroup.Item
      value={value}
      className="flex items-center justify-center px-2 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest border border-border/40 bg-background/20 text-muted-foreground transition-all hover:bg-accent hover:text-foreground data-[state=on]:bg-primary/20 data-[state=on]:border-primary/50 data-[state=on]:text-primary data-[state=on]:shadow-lg data-[state=on]:shadow-primary/10"
    >
      {label}
    </ToggleGroup.Item>
  );
}
