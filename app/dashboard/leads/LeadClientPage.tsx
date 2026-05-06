'use client';

import { useEffect, useMemo, useState } from 'react';
import * as ToggleGroup from '@radix-ui/react-toggle-group';
import { read, utils } from 'xlsx';
import Papa from 'papaparse';
import { AlertTriangle, Check, CheckCircle, Clock, Database, Filter, Info, PartyPopper, UploadCloud } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { cn } from '@/lib/utils';

import DynamicTable from '@/components/dynamic/dynamicTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RunValidationButton } from '@/components/buttton/RunValidationButton';
import {
  assignLeadsToFolderAction,
  createLeadFolderAction,
  getFolderMembersAction,
  resetStuckAndRerunAction,
  getValidationRunStatusAction,
  rerunFailedValidationAction,
  runEmailValidationAction,
  uploadImportedLeadsAction,
  type ImportReport,
  type ImportUiError,
  type LeadFolder,
  type ValidationRunStatusResponse,
} from './actions';

type Props = {
  leads: any[];
  relations: any;
  role?: string;
  initialFolders: LeadFolder[];
};

type LeadView = 'all' | 'validated' | 'pending' | 'risky' | 'blocked' | 'used' | 'free';

type ParsedImport = {
  fileType: 'csv' | 'xlsx';
  columns: string[];
  rows: Record<string, unknown>[];
};

type CombineSeparator = ',' | ' ' | '\n';

type CombineMappingRule = {
  mode: 'combine';
  columns: string[];
  separator?: CombineSeparator;
};

type MappingValue = string | CombineMappingRule;
type LeadScope = { type: 'all' } | { type: 'folder'; folderId: string };

const SUPPORTED_FIELDS = [
  'email',
  'first_name',
  'last_name',
  'company',
  'job_title',
  'country',
  'phone',
  'linkedin_url',
  'website',
  'company_description',
  'industry',
  'employee_size',
  'source',
  'tags',
  'notes',
] as const;

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
  const [importData, setImportData] = useState<ParsedImport | null>(null);
  const [mapping, setMapping] = useState<Record<string, MappingValue>>({});
  const [importSource, setImportSource] = useState('');
  const [importTags, setImportTags] = useState('');
  const [selectedOperatorId, setSelectedOperatorId] = useState('');
  const [importReport, setImportReport] = useState<ImportReport | null>(null);
  const [importError, setImportError] = useState<ImportUiError | null>(null);
  const [showImportErrorDetails, setShowImportErrorDetails] = useState(false);
  const [importing, setImporting] = useState(false);
  const [validationStatus, setValidationStatus] = useState<ValidationRunStatusResponse | null>(null);
  const [validationLoading, setValidationLoading] = useState(true);
  const [folders, setFolders] = useState<LeadFolder[]>(initialFolders ?? []);
  const [newFolderName, setNewFolderName] = useState('');
  const [folderSelection, setFolderSelection] = useState('');
  const [scope, setScope] = useState<LeadScope>(
    (initialFolders?.length ?? 0) > 0 ? { type: 'folder', folderId: initialFolders[0].id } : { type: 'all' }
  );
  const [folderMembersCache, setFolderMembersCache] = useState<Record<string, string[]>>({});
  const [folderBusy, setFolderBusy] = useState(false);

  const providers = useMemo(
    () => Array.from(new Set(leads.map((l) => l.provider).filter(Boolean))),
    [leads]
  );

  const sources = useMemo(
    () => Array.from(new Set(leads.map((l) => l.source).filter(Boolean))),
    [leads]
  );

  const operators = useMemo(() => {
    return Array.isArray(relations?.operators) ? relations.operators : [];
  }, [relations]);

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
    setFolderSelection((prev) => prev || scope.folderId);
    if (folderMembersCache[scope.folderId]) return;
    let active = true;
    void getFolderMembersAction(scope.folderId)
      .then((res) => {
        if (!active) return;
        setFolderMembersCache((prev) => ({ ...prev, [scope.folderId]: res.lead_ids ?? [] }));
      })
      .catch(() => {
        if (!active) return;
        setFolderMembersCache((prev) => ({ ...prev, [scope.folderId]: [] }));
      });
    return () => {
      active = false;
    };
  }, [folderMembersCache, scope]);

  const activeFolderLeadIds = useMemo(() => {
    if (scope.type !== 'folder') return null;
    return folderMembersCache[scope.folderId] ?? [];
  }, [folderMembersCache, scope]);

  const scopeLeads = useMemo(() => {
    if (scope.type === 'all') return leads;
    const ids = new Set(activeFolderLeadIds ?? []);
    return leads.filter((lead) => ids.has(lead.id));
  }, [activeFolderLeadIds, leads, scope]);

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
      if (scope.type === 'folder' && !(activeFolderLeadIds ?? []).includes(lead.id)) return false;

      if (riskMax) {
        const max = Number(riskMax);
        const score = Number(lead.risk_score ?? 0);
        if (!Number.isNaN(max) && score > max) return false;
      }

      return true;
    });
  }, [activeFolderLeadIds, leads, providerFilter, riskMax, scope, sourceFilter, view]);

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
  const showFreshPendingHint =
    !hasActiveRun &&
    validationStatus?.status === 'completed' &&
    (validationStatus?.metrics.totalTargeted ?? 0) === 0 &&
    pendingAvailable > 0;
  const showStalledWarning = processingNow > 0 && recentUpdates === 0;

  const resolvedPreviewRows = useMemo(() => {
    if (!importData) return [];

    const resolveCombined = (row: Record<string, unknown>, rule: CombineMappingRule) => {
      const sep = rule.separator ?? ',';
      return rule.columns
        .map((col) => row[col])
        .map((v) => (v == null ? '' : String(v).trim()))
        .filter(Boolean)
        .join(sep);
    };

    return importData.rows.slice(0, 5).map((row) => {
      const out: Record<string, unknown> = {};
      for (const field of SUPPORTED_FIELDS) {
        const rule = mapping[field];
        if (!rule) continue;
        if (typeof rule === 'string') {
          out[field] = row[rule];
        } else if (rule.mode === 'combine') {
          out[field] = resolveCombined(row, rule);
        }
      }
      return out;
    });
  }, [importData, mapping]);

  const hasValidEmailMapping = useMemo(() => {
    const emailRule = mapping.email;
    if (!emailRule) return false;
    if (typeof emailRule === 'string') return Boolean(emailRule);
    return emailRule.columns.length >= 2;
  }, [mapping.email]);

  const hasInvalidCombineConfig = useMemo(() => {
    return SUPPORTED_FIELDS.some((field) => {
      const rule = mapping[field];
      if (!rule || typeof rule === 'string') return false;
      return rule.columns.length > 0 && rule.columns.length < 2;
    });
  }, [mapping]);

  function setSingleMapping(field: string, source: string) {
    setMapping((prev) => ({ ...prev, [field]: source }));
  }

  function setCombineMode(field: string) {
    setMapping((prev) => {
      const current = prev[field];
      if (typeof current !== 'string' && current?.mode === 'combine') return prev;
      return {
        ...prev,
        [field]: { mode: 'combine', columns: [], separator: ',' },
      };
    });
  }

  function setSingleMode(field: string) {
    setMapping((prev) => {
      const current = prev[field];
      const fallback = typeof current === 'string' ? current : '';
      return { ...prev, [field]: fallback };
    });
  }

  function updateCombineColumns(field: string, columns: string[]) {
    setMapping((prev) => {
      const current = prev[field];
      const next: CombineMappingRule =
        typeof current === 'string' || !current
          ? { mode: 'combine', columns, separator: ',' }
          : { ...current, columns };
      return { ...prev, [field]: next };
    });
  }

  function moveCombineColumn(field: string, index: number, direction: 'up' | 'down') {
    const current = mapping[field];
    if (!current || typeof current === 'string') return;
    const columns = [...current.columns];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= columns.length) return;
    [columns[index], columns[swapIndex]] = [columns[swapIndex], columns[index]];
    updateCombineColumns(field, columns);
  }

  function setCombineSeparator(field: string, separator: CombineSeparator) {
    setMapping((prev) => {
      const current = prev[field];
      if (!current || typeof current === 'string') return prev;
      return { ...prev, [field]: { ...current, separator } };
    });
  }

  async function parseFile(file: File) {
    if (file.name.toLowerCase().endsWith('.csv')) {
      const rows = await new Promise<Record<string, unknown>[]>((resolve, reject) => {
        Papa.parse<Record<string, unknown>>(file, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => resolve(results.data),
          error: (err) => reject(err),
        });
      });
      const columns = Object.keys(rows[0] ?? {});
      setImportData({ fileType: 'csv', columns, rows });
      setMapping({ email: columns.find((c) => c.toLowerCase().includes('email')) ?? '' });
      return;
    }

    if (file.name.toLowerCase().endsWith('.xlsx')) {
      const buffer = await file.arrayBuffer();
      const wb = read(buffer, { type: 'array' });
      const firstSheet = wb.SheetNames[0];
      const sheet = wb.Sheets[firstSheet];
      const jsonRows = utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
      const columns = Object.keys(jsonRows[0] ?? {});
      setImportData({ fileType: 'xlsx', columns, rows: jsonRows });
      setMapping({ email: columns.find((c) => c.toLowerCase().includes('email')) ?? '' });
      return;
    }

    throw new Error('Only CSV and XLSX files are supported.');
  }

  async function submitImport() {
    if (!importData) return;

    setImporting(true);
    setImportError(null);
    setShowImportErrorDetails(false);
    try {
      const report = await uploadImportedLeadsAction({
        fileType: importData.fileType,
        mapping,
        rows: importData.rows,
        operator_id: (role?.toLowerCase() === 'admin' || operators.length > 0) ? selectedOperatorId || undefined : undefined,
        source: importSource || undefined,
        tags: importTags.split(',').map((v) => v.trim()).filter(Boolean),
      });
      setImportReport(report);
      toast.success('Onboarding sequence completed successfully.', {
        duration: 5000,
        style: {
          background: '#0a0a0a',
          color: '#fff',
          border: '1px solid rgba(255,255,255,0.1)',
          backdropFilter: 'blur(10px)',
        },
      });
      setImporting(false);
    } catch (err: any) {
      const fallback: ImportUiError = {
        userMessage: 'Lead import failed. Please retry.',
        raw: err?.message || 'Unknown error',
      };
      try {
        const parsed = JSON.parse(String(err?.message ?? ''));
        if (parsed?.userMessage) {
          setImportError({
            userMessage: String(parsed.userMessage),
            statusCode: parsed.statusCode ? Number(parsed.statusCode) : undefined,
            raw: parsed.raw ? String(parsed.raw) : undefined,
          });
        } else {
          setImportError(fallback);
        }
      } catch {
        setImportError(fallback);
      }
    } finally {
      setImporting(false);
    }
  }

  async function handleCreateFolder() {
    const name = newFolderName.trim();
    if (!name) return;
    setFolderBusy(true);
    try {
      const res = await createLeadFolderAction(name);
      setFolders((prev) => [...prev, res.folder].sort((a, b) => a.name.localeCompare(b.name)));
      setFolderMembersCache((prev) => ({ ...prev, [res.folder.id]: [] }));
      if (scope.type === 'all') {
        setScope({ type: 'folder', folderId: res.folder.id });
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
      setFolderMembersCache((prev) => {
        const existing = new Set(prev[folderSelection] ?? []);
        for (const id of leadIds) existing.add(id);
        return { ...prev, [folderSelection]: Array.from(existing) };
      });
      setFolders((prev) =>
        prev.map((folder) =>
          folder.id === folderSelection
            ? {
                ...folder,
                lead_count: Math.max(
                  folder.lead_count,
                  new Set([...(folderMembersCache[folderSelection] ?? []), ...leadIds]).size
                ),
              }
            : folder
        )
      );
      toast.success(`Assigned ${leadIds.length} leads to folder`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to assign leads to folder');
    } finally {
      setFolderBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-8 pb-10 max-w-[1600px] mx-auto">
      {/* KPI Dashboard */}
      <section className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-4">
        <KpiCard label="Total Imported" value={kpis.total} icon={<Database className="w-4 h-4 text-blue-400" />} color="blue" />
        <KpiCard label="Valid" value={kpis.validated} icon={<CheckCircle className="w-4 h-4 text-green-400" />} color="green" />
        <KpiCard label="Invalid" value={kpis.invalid} icon={<AlertTriangle className="w-4 h-4 text-red-400" />} color="red" />
        <KpiCard label="Duplicate" value={kpis.duplicate} icon={<Filter className="w-4 h-4 text-yellow-400" />} color="yellow" />
        <KpiCard label="Pending" value={kpis.pending} icon={<Clock className="w-4 h-4 text-purple-400" />} color="purple" />
        <KpiCard label="Blocked" value={kpis.blocked} icon={<AlertTriangle className="w-4 h-4 text-orange-400" />} color="orange" />
        <KpiCard label="Used" value={kpis.used} icon={<CheckCircle className="w-4 h-4 text-gray-400" />} color="gray" />
        <KpiCard label="Free" value={kpis.free} icon={<Database className="w-4 h-4 text-teal-400" />} color="teal" />
      </section>

      <section className="rounded-2xl border border-border/40 bg-card/30 backdrop-blur-md p-6 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold tracking-tight flex items-center gap-2 text-foreground">
              <Database className="h-5 w-5 text-teal-400" /> Lead Folders
            </h3>
            <p className="text-xs text-muted-foreground mt-1">Folder-first view. Only selected folder leads are shown unless Select All is active.</p>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <Input
              placeholder="New folder name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              className="h-10 text-xs md:w-64"
            />
            <Button onClick={() => void handleCreateFolder()} disabled={folderBusy || !newFolderName.trim()} className="h-10 text-xs">
              Create Folder
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={scope.type === 'all' ? 'default' : 'outline'}
            className="text-xs h-8"
            onClick={() => setScope({ type: 'all' })}
          >
            Select All ({leads.length})
          </Button>
          {folders.map((folder) => (
            <Button
              key={folder.id}
              variant={scope.type === 'folder' && scope.folderId === folder.id ? 'default' : 'outline'}
              className="text-xs h-8"
              onClick={() => setScope({ type: 'folder', folderId: folder.id })}
            >
              {folder.name} ({folder.lead_count})
            </Button>
          ))}
        </div>

        <div className="grid md:grid-cols-[1fr_auto] gap-3 items-end">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Assign Current View Leads to Folder</label>
            <select
              className="w-full rounded-lg border border-border/60 bg-background/50 px-3 py-2 text-xs"
              value={folderSelection}
              onChange={(e) => setFolderSelection(e.target.value)}
            >
              <option value="">Choose folder</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
          </div>
          <Button
            variant="outline"
            onClick={() => void handleAssignFilteredToFolder()}
            disabled={folderBusy || !folderSelection}
            className="text-xs h-10"
          >
            Add {filteredLeads.length} leads to folder
          </Button>
        </div>
      </section>

      {/* Main Controls Grid */}
      <div className="grid lg:grid-cols-3 gap-6 items-start">
        
        {/* Import Center */}
        <section className="lg:col-span-2 rounded-2xl border border-border/40 bg-card/30 backdrop-blur-md p-6 shadow-xl space-y-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/50 via-blue-500/50 to-primary/50" />
          
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <h3 className="text-xl font-bold tracking-tight flex items-center gap-2 text-foreground">
                <UploadCloud className="h-5 w-5 text-primary" /> Import Center
              </h3>
              <p className="text-sm text-muted-foreground mt-1">Onboard your lead lists into the mission control system.</p>
            </div>
            {importData && (
              <Button variant="ghost" size="sm" onClick={() => setImportData(null)} className="text-xs hover:bg-red-500/10 hover:text-red-400 transition-colors">
                Clear Selection
              </Button>
            )}
          </div>

          {!importData ? (
            <div className="group relative">
              <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-border/60 rounded-2xl bg-background/20 hover:bg-background/40 hover:border-primary/50 transition-all cursor-pointer group-hover:shadow-2xl group-hover:shadow-primary/5">
                <div className="flex flex-col items-center justify-center pt-5 pb-6 space-y-4">
                  <div className="p-4 rounded-full bg-primary/10 text-primary group-hover:scale-110 transition-transform duration-300">
                    <UploadCloud className="w-8 h-8" />
                  </div>
                  <div className="text-center">
                    <p className="mb-1 text-base font-semibold text-foreground">Click to upload or drag and drop</p>
                    <p className="text-xs text-muted-foreground">Supported formats: CSV, XLSX (Max 10MB)</p>
                  </div>
                </div>
                <input 
                  type="file" 
                  className="hidden" 
                  accept=".csv,.xlsx" 
                  onChange={(e) => e.target.files?.[0] && parseFile(e.target.files[0])} 
                />
              </label>
            </div>
          ) : (
            <div className="space-y-8 animate-in fade-in zoom-in-95 duration-300">
              {/* Top Config Row */}
              <div className={cn(
                "grid gap-6 p-4 rounded-xl bg-accent/20 border border-border/40",
                (role?.toLowerCase() === 'admin' || operators.length > 0) ? "md:grid-cols-4" : "md:grid-cols-3"
              )}>
                {(role?.toLowerCase() === 'admin' || operators.length > 0) && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Operator</label>
                    <select
                      className="h-11 w-full rounded-lg border border-border/60 bg-background/50 px-3 py-2 text-sm focus:ring-2 focus:ring-primary/30 outline-none transition-all hover:border-primary/50 shadow-inner"
                      value={selectedOperatorId}
                      onChange={(e) => setSelectedOperatorId(e.target.value)}
                    >
                      <option value="">Select operator</option>
                      {operators.map((op: any) => (
                        <option key={op.id} value={op.id}>
                          {op.name} {op.region ? `(${op.region})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Data Source</label>
                  <Input 
                    placeholder="e.g. LinkedIn Export" 
                    value={importSource} 
                    onChange={(e) => setImportSource(e.target.value)} 
                    className="h-11 bg-background/50 border-border/60 focus:border-primary/50 shadow-inner"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Tags</label>
                  <Input 
                    placeholder="comma separated" 
                    value={importTags} 
                    onChange={(e) => setImportTags(e.target.value)} 
                    className="h-11 bg-background/50 border-border/60 focus:border-primary/50 shadow-inner"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">File Information</label>
                  <div className="h-11 flex items-center px-4 rounded-lg bg-background/30 border border-border/30 text-xs font-mono text-primary truncate italic">
                    {importData.columns.length} columns detected
                  </div>
                </div>
              </div>

              {/* Mapping Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <h4 className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                    <Database className="w-4 h-4 text-primary" /> Column Mapping
                  </h4>
                  <div className="h-px flex-1 bg-border/40" />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 h-[400px] overflow-y-auto pr-2 custom-scrollbar p-1">
                  {SUPPORTED_FIELDS.map((field) => (
                    <div key={field} className="flex flex-col gap-3 rounded-xl border border-border/40 bg-card/40 p-4 transition-all hover:bg-card/60 hover:border-primary/30 group">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-foreground group-hover:text-primary transition-colors">{field.replace('_', ' ')}</span>
                        {field === 'email' && <span className="text-[9px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded uppercase font-bold">Required</span>}
                      </div>

                      <div className="flex p-0.5 rounded-lg bg-background/50 border border-border/40">
                        <button
                          type="button"
                          className={cn(
                            "flex-1 py-1 text-[10px] font-bold uppercase rounded-md transition-all",
                            typeof mapping[field] === 'string' || !mapping[field] ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                          )}
                          onClick={() => setSingleMode(field)}
                        >
                          Single
                        </button>
                        <button
                          type="button"
                          className={cn(
                            "flex-1 py-1 text-[10px] font-bold uppercase rounded-md transition-all",
                            typeof mapping[field] !== 'string' && mapping[field] ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                          )}
                          onClick={() => setCombineMode(field)}
                        >
                          Combine
                        </button>
                      </div>

                      {(typeof mapping[field] === 'string' || !mapping[field]) ? (
                        <select
                          className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-xs focus:ring-2 focus:ring-primary/30 outline-none transition-all hover:border-primary/50"
                          value={typeof mapping[field] === 'string' ? mapping[field] : ''}
                          onChange={(e) => setSingleMapping(field, e.target.value)}
                        >
                          <option value="" className="text-muted-foreground italic">Not mapped</option>
                          {importData.columns.map((col) => (
                            <option key={col} value={col}>{col}</option>
                          ))}
                        </select>
                      ) : (
                        <div className="space-y-3">
                          <div className="max-h-32 overflow-y-auto rounded-lg border border-border/60 bg-background p-1.5 custom-scrollbar">
                            <div className="flex flex-col gap-0.5">
                              {importData.columns.map((col) => {
                                const isSelected = (mapping[field] as CombineMappingRule).columns.includes(col);
                                return (
                                  <label 
                                    key={col} 
                                    className={cn(
                                      "flex items-center gap-2 px-2 py-1.5 rounded-md text-[10px] cursor-pointer transition-colors",
                                      isSelected ? "bg-primary/10 text-primary font-medium" : "hover:bg-accent text-muted-foreground hover:text-foreground"
                                    )}
                                  >
                                    <input 
                                      type="checkbox" 
                                      className="sr-only"
                                      checked={isSelected}
                                      onChange={(e) => {
                                        const current = (mapping[field] as CombineMappingRule).columns;
                                        const next = e.target.checked 
                                          ? [...current, col]
                                          : current.filter(c => c !== col);
                                        updateCombineColumns(field, next);
                                      }}
                                    />
                                    <div className={cn(
                                      "w-3 h-3 rounded flex items-center justify-center border transition-all duration-200",
                                      isSelected ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/40 bg-background"
                                    )}>
                                      {isSelected && <Check className="w-2.5 h-2.5" />}
                                    </div>
                                    <span className="truncate">{col}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <select
                              className="flex-1 rounded-md border border-border/60 bg-background px-2 py-1 text-[10px] focus:ring-1 focus:ring-primary/30 outline-none"
                              value={(mapping[field] as CombineMappingRule).separator ?? ','}
                              onChange={(e) => setCombineSeparator(field, e.target.value as CombineSeparator)}
                            >
                              <option value=",">Comma</option>
                              <option value=" ">Space</option>
                              <option value={"\n"}>Newline</option>
                            </select>
                            <span className="text-[10px] text-muted-foreground italic">Separator</span>
                          </div>

                          <div className="space-y-1">
                            {(mapping[field] as CombineMappingRule).columns.map((col, idx) => (
                              <div key={`${field}-${col}-${idx}`} className="flex items-center gap-1 text-[9px]">
                                <span className="flex-1 truncate rounded bg-muted/60 px-2 py-1 border border-border/30">{col}</span>
                                <Button type="button" size="icon" variant="outline" className="w-5 h-5" onClick={() => moveCombineColumn(field, idx, 'up')} disabled={idx === 0}>↑</Button>
                                <Button type="button" size="icon" variant="outline" className="w-5 h-5" onClick={() => moveCombineColumn(field, idx, 'down')} disabled={idx === (mapping[field] as CombineMappingRule).columns.length - 1}>↓</Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Preview & Submit */}
              <div className="grid md:grid-cols-2 gap-8 pt-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <Filter className="w-3.5 h-3.5" /> Live Preview
                    </h4>
                    <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-mono">{importData.rows.length} rows total</span>
                  </div>
                  <pre className="h-[200px] overflow-auto rounded-xl border border-border/60 bg-black/60 p-4 text-[10px] font-mono text-green-400 custom-scrollbar shadow-inner">
                    {JSON.stringify(resolvedPreviewRows.length ? resolvedPreviewRows : importData.rows.slice(0, 5), null, 2)}
                  </pre>
                </div>
                
                <div className="flex flex-col justify-between gap-6">
                  <div className="bg-primary/5 p-5 rounded-2xl border border-primary/20 space-y-3">
                    <h5 className="text-xs font-bold uppercase tracking-widest text-primary">Import Checklist</h5>
                    <ul className="space-y-2">
                      <li className="flex items-center gap-2 text-xs text-foreground/80">
                        <div className={cn("w-1.5 h-1.5 rounded-full", hasValidEmailMapping ? "bg-green-500" : "bg-red-500 animate-pulse")} />
                        Email Mapping Required
                      </li>
                      <li className="flex items-center gap-2 text-xs text-foreground/80">
                        <div className={cn("w-1.5 h-1.5 rounded-full", !hasInvalidCombineConfig ? "bg-green-500" : "bg-amber-500")} />
                        Valid Combination Logic
                      </li>
                      <li className="flex items-center gap-2 text-xs text-foreground/80">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        Duplicates Ignored Automatically
                      </li>
                    </ul>
                  </div>

                  <div className="space-y-4">
                    {importError && (
                      <div className="animate-in slide-in-from-bottom-2 duration-300">
                        <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl p-3 space-y-2">
                          <div className="font-bold flex items-center gap-2">
                            <AlertTriangle className="w-3 h-3" /> {importError.userMessage}
                          </div>
                          <div className="flex items-center gap-3">
                            <button type="button" className="text-[10px] uppercase font-bold text-red-200 hover:text-white transition-colors" onClick={() => setShowImportErrorDetails(!showImportErrorDetails)}>
                              {showImportErrorDetails ? 'Hide Details' : 'View Raw Logs'}
                            </button>
                            <button type="button" className="text-[10px] uppercase font-bold text-red-200 hover:text-white transition-colors" onClick={() => { setImportError(null); setShowImportErrorDetails(false); }}>
                              Dismiss
                            </button>
                          </div>
                          {showImportErrorDetails && (
                            <pre className="mt-2 rounded bg-black/40 p-2 text-[9px] font-mono opacity-80 max-h-24 overflow-auto custom-scrollbar">
                              {importError.raw}
                            </pre>
                          )}
                        </div>
                      </div>
                    )}

                    {(role?.toLowerCase() === 'admin' || operators.length > 0) && !selectedOperatorId && (
                      <div className="text-[10px] text-amber-400 font-bold uppercase tracking-widest text-center py-2 animate-pulse">
                        ⚠️ Please Select an operator
                      </div>
                    )}

                    <Button 
                      onClick={submitImport} 
                      disabled={importing || !hasValidEmailMapping || hasInvalidCombineConfig || ((role?.toLowerCase() === 'admin' || operators.length > 0) && !selectedOperatorId)}
                      className="w-full h-14 text-base font-bold shadow-2xl shadow-primary/20 transition-all hover:scale-[1.01] active:scale-[0.98] rounded-xl"
                    >
                      {importing ? (
                        <span className="flex items-center gap-2">
                          <Clock className="w-5 h-5 animate-spin" /> Finalizing Import...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <CheckCircle className="w-5 h-5" /> Execute Lead Onboarding
                        </span>
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              {importReport && (
                <div className="animate-in slide-in-from-top-4 duration-700 pt-8 border-t border-border/40 space-y-6">
                  <div className="flex flex-col items-center text-center space-y-2 mb-4">
                    <div className="p-3 rounded-full bg-green-500/20 text-green-500 animate-bounce">
                      <PartyPopper className="w-6 h-6" />
                    </div>
                    <h4 className="text-xl font-bold text-foreground">Mission Successful</h4>
                    <p className="text-sm text-muted-foreground">The lead onboarding protocol has been executed with the following results:</p>
                  </div>

                  <div className="grid grid-cols-3 gap-6">
                    <div className="relative group rounded-2xl border border-green-500/30 bg-green-500/5 p-6 text-center transition-all hover:bg-green-500/10 shadow-lg shadow-green-500/5">
                      <div className="text-[10px] font-bold text-green-500/70 uppercase tracking-[0.2em] mb-2">Successfully Onboarded</div>
                      <div className="text-4xl font-black text-green-500 tracking-tighter">{importReport.insertedCount}</div>
                    </div>
                    <div className="relative group rounded-2xl border border-yellow-500/30 bg-yellow-500/5 p-6 text-center transition-all hover:bg-yellow-500/10 shadow-lg shadow-yellow-500/5">
                      <div className="text-[10px] font-bold text-yellow-500/70 uppercase tracking-[0.2em] mb-2">Duplicate Entries</div>
                      <div className="text-4xl font-black text-yellow-500 tracking-tighter">{importReport.duplicateCount}</div>
                    </div>
                    <div className="relative group rounded-2xl border border-red-500/30 bg-red-500/5 p-6 text-center transition-all hover:bg-red-500/10 shadow-lg shadow-red-500/5">
                      <div className="text-[10px] font-bold text-red-500/70 uppercase tracking-[0.2em] mb-2">Invalid Format</div>
                      <div className="text-4xl font-black text-red-500 tracking-tighter">{importReport.invalidCount}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-center gap-4 pt-2">
                    {importReport.invalidCount > 0 && (
                      <a
                        className="text-xs font-bold text-red-400 hover:text-red-300 flex items-center gap-2 px-6 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 transition-all hover:scale-105"
                        href={`data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(importReport.invalidRows, null, 2))}`}
                        download="onboarding-error-report.json"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" /> Download Error Log
                      </a>
                    )}
                    <Button variant="outline" onClick={() => setImportReport(null)} className="text-xs font-bold px-6 py-2.5 rounded-xl bg-background/20 hover:bg-background/40">
                      Close Report
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Validation & Filtering (Sidebar-ish) */}
        <div className="space-y-6">
          <section className="rounded-2xl border border-border/40 bg-card/30 backdrop-blur-md p-6 shadow-xl space-y-6">
            <div className="flex flex-col">
              <h3 className="text-lg font-bold tracking-tight flex items-center gap-2 text-foreground">
                <CheckCircle className="h-5 w-5 text-green-500" /> Validation
              </h3>
              <p className="text-xs text-muted-foreground mt-1">Manage pipeline checks.</p>
            </div>
            <div className="rounded-xl border border-border/40 bg-background/30 p-3 space-y-2">
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
                  <div className="grid grid-cols-2 gap-2 text-[10px] text-muted-foreground">
                    <div>Targeted: <span className="text-foreground">{validationStatus?.metrics.totalTargeted ?? 0}</span></div>
                    <div>Processed: <span className="text-foreground">{validationStatus?.metrics.processed ?? 0}</span></div>
                    <div>Remaining: <span className="text-foreground">{validationStatus?.metrics.remaining ?? 0}</span></div>
                    <div>Done: <span className="text-foreground">{validationStatus?.metrics.completionPercent ?? 0}%</span></div>
                    <div>Processing now: <span className="text-foreground">{validationStatus?.availability?.processingNow ?? 0}</span></div>
                    <div>Stuck processing: <span className="text-foreground">{validationStatus?.availability?.stuckProcessing ?? 0}</span></div>
                    <div>Updated in last 2 min: <span className="text-foreground">{validationStatus?.availability?.recentUpdates ?? 0}</span></div>
                    <div>Total leads: <span className="text-foreground">{validationStatus?.availability?.totalLeads ?? 0}</span></div>
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    Processing now = leads picked by worker but not completed yet.
                  </div>
                  {showStalledWarning && (
                    <div className="text-[10px] text-amber-400">
                      Worker appears stalled. Auto-recovery is active for stale rows.
                    </div>
                  )}
                  {validationStatus?.availability?.lastProgressAt && (
                    <div className="text-[10px] text-muted-foreground">
                      Last progress at: {new Date(validationStatus.availability.lastProgressAt).toLocaleString()}
                    </div>
                  )}
                  {showFreshPendingHint && (
                    <div className="text-[10px] text-emerald-300">
                      New pending leads are available for validation.
                    </div>
                  )}
                  {!showFreshPendingHint && validationStatus?.status === 'completed' && (validationStatus?.metrics.totalTargeted ?? 0) === 0 && (
                    <div className="text-[10px] text-amber-400">
                      No eligible pending leads matched backend criteria.
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
            <div className="flex flex-col gap-3">
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
                successText="Stuck processing rows reset and validation restarted"
                onRun={async () => {
                  const result = await resetStuckAndRerunAction();
                  await refreshValidationStatus();
                  return result;
                }}
                disabled={validationStatus?.status === 'running' || validationStatus?.status === 'queued'}
                disabledText="A validation run is currently active."
              />
              <Button variant="outline" className="w-full justify-start border-primary/20 hover:bg-primary/10 hover:text-primary font-bold text-xs" onClick={() => alert('Use filtered Validated view as campaign-ready pool.')}>
                Prepare Campaign Pool
              </Button>
            </div>
          </section>

          <section className="rounded-2xl border border-border/40 bg-card/30 backdrop-blur-md p-6 shadow-xl space-y-6">
            <div className="flex flex-col">
              <h3 className="text-lg font-bold tracking-tight flex items-center gap-2 text-foreground">
                <Filter className="h-5 w-5 text-blue-400" /> Smart Filters
              </h3>
              <p className="text-xs text-muted-foreground mt-1">Quick view toggles.</p>
            </div>

            <ToggleGroup.Root
              type="single"
              value={view}
              onValueChange={(v) => v && setView(v as LeadView)}
              className="grid grid-cols-3 gap-2"
            >
              <ToggleItem value="all" label="All" />
              <ToggleItem value="validated" label="Valid" />
              <ToggleItem value="pending" label="Pending" />
              <ToggleItem value="risky" label="Risky" />
              <ToggleItem value="blocked" label="Blocked" />
              <ToggleItem value="used" label="Used" />
              <ToggleItem value="free" label="Free" />
            </ToggleGroup.Root>

            <div className="space-y-4 pt-4 border-t border-border/40">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Provider</label>
                <select className="w-full rounded-lg border border-border/60 bg-background/50 px-3 py-2 text-xs focus:ring-2 focus:ring-primary/30 outline-none transition-all hover:border-primary/50" value={providerFilter} onChange={(e) => setProviderFilter(e.target.value)}>
                  <option value="">All Providers</option>
                  {providers.map((provider) => (
                    <option key={provider} value={provider}>{provider}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Source</label>
                <select className="w-full rounded-lg border border-border/60 bg-background/50 px-3 py-2 text-xs focus:ring-2 focus:ring-primary/30 outline-none transition-all hover:border-primary/50" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
                  <option value="">All Sources</option>
                  {sources.map((source) => (
                    <option key={source} value={source}>{source}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Risk Limit</label>
                <Input placeholder="e.g. 30" value={riskMax} onChange={(e) => setRiskMax(e.target.value)} className="bg-background/50 text-xs h-10 border-border/60" />
              </div>

            </div>
          </section>
        </div>
      </div>

      <div className="rounded-2xl border border-border/40 bg-card/20 backdrop-blur-sm p-1 shadow-2xl overflow-hidden">
        <DynamicTable table="leads" data={filteredLeads} role={role} relations={relations} />
      </div>
    </div>
  );
}

function KpiCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  const colorMap: Record<string, string> = {
    blue: "from-blue-500/20 to-transparent border-blue-500/30",
    green: "from-green-500/20 to-transparent border-green-500/30",
    red: "from-red-500/20 to-transparent border-red-500/30",
    yellow: "from-yellow-500/20 to-transparent border-yellow-500/30",
    purple: "from-purple-500/20 to-transparent border-purple-500/30",
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
