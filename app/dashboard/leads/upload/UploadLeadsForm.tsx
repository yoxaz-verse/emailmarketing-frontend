'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { read, utils } from 'xlsx';
import Papa from 'papaparse';
import { AlertTriangle, Check, CheckCircle, Clock, Database, Filter, PartyPopper, UploadCloud } from 'lucide-react';
import { toast } from 'react-hot-toast';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  uploadImportedLeadsAction,
  type ImportReport,
  type ImportUiError,
} from '../actions';

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
type Operator = { id: string; name: string; region?: string | null };

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

export default function UploadLeadsForm({
  role,
  operators,
}: {
  role?: string;
  operators: Operator[];
}) {
  const [importData, setImportData] = useState<ParsedImport | null>(null);
  const [mapping, setMapping] = useState<Record<string, MappingValue>>({});
  const [importSource, setImportSource] = useState('');
  const [importTags, setImportTags] = useState('');
  const [selectedOperatorId, setSelectedOperatorId] = useState('');
  const [importReport, setImportReport] = useState<ImportReport | null>(null);
  const [importError, setImportError] = useState<ImportUiError | null>(null);
  const [showImportErrorDetails, setShowImportErrorDetails] = useState(false);
  const [importing, setImporting] = useState(false);
  const [duplicateMode, setDuplicateMode] = useState<'skip' | 'replace'>('skip');

  const hasOperatorSelection = (role?.toLowerCase() === 'admin' || role?.toLowerCase() === 'superadmin' || operators.length > 0);

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
        operator_id: hasOperatorSelection ? selectedOperatorId || undefined : undefined,
        source: importSource || undefined,
        tags: importTags
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean),
        duplicate_mode: duplicateMode,
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
    } catch (err: unknown) {
      const fallback: ImportUiError = {
        userMessage: 'Lead import failed. Please retry.',
        raw: err instanceof Error ? err.message : 'Unknown error',
      };
      try {
        const parsed = JSON.parse(err instanceof Error ? String(err.message ?? '') : '');
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

  return (
    <section className="rounded-2xl border border-border/40 bg-card/30 backdrop-blur-md p-6 shadow-xl space-y-8 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/50 via-blue-500/50 to-primary/50" />

      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col">
          <h3 className="text-xl font-bold tracking-tight flex items-center gap-2 text-foreground">
            <UploadCloud className="h-5 w-5 text-primary" /> Import Center
          </h3>
          <p className="text-sm text-muted-foreground mt-1">Onboard your lead lists into the mission control system.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/leads" className="inline-flex h-9 items-center rounded-md border border-border px-3 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground">
            Go to Leads
          </Link>
          {importData && (
            <Button variant="ghost" size="sm" onClick={() => setImportData(null)} className="text-xs hover:bg-red-500/10 hover:text-red-400 transition-colors">
              Clear Selection
            </Button>
          )}
        </div>
      </div>

      {!importData ? (
        <div className="group relative">
          <label className="flex flex-col items-center justify-center w-full h-72 border-2 border-dashed border-border/60 rounded-2xl bg-background/20 hover:bg-background/40 hover:border-primary/50 transition-all cursor-pointer group-hover:shadow-2xl group-hover:shadow-primary/5">
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
          <div className={cn(
            'grid gap-6 p-4 rounded-xl bg-accent/20 border border-border/40',
            hasOperatorSelection ? 'md:grid-cols-5' : 'md:grid-cols-4'
          )}>
            {hasOperatorSelection && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Operator</label>
                <select
                  className="h-11 w-full rounded-lg border border-border/60 bg-background/50 px-3 py-2 text-sm focus:ring-2 focus:ring-primary/30 outline-none transition-all hover:border-primary/50 shadow-inner"
                  value={selectedOperatorId}
                  onChange={(e) => setSelectedOperatorId(e.target.value)}
                >
                  <option value="">Select operator</option>
                  {operators.map((op) => (
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
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Duplicate Strategy</label>
              <select
                className="h-11 w-full rounded-lg border border-border/60 bg-background/50 px-3 py-2 text-sm focus:ring-2 focus:ring-primary/30 outline-none transition-all hover:border-primary/50 shadow-inner"
                value={duplicateMode}
                onChange={(e) => setDuplicateMode(e.target.value as 'skip' | 'replace')}
              >
                <option value="skip">Skip duplicates (recommended)</option>
                <option value="replace">Replace existing leads</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">File Information</label>
              <div className="h-11 flex items-center px-4 rounded-lg bg-background/30 border border-border/30 text-xs font-mono text-primary truncate italic">
                {importData.columns.length} columns detected
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <h4 className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                <Database className="w-4 h-4 text-primary" /> Column Mapping
              </h4>
              <div className="h-px flex-1 bg-border/40" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 h-[420px] overflow-y-auto pr-2 custom-scrollbar p-1">
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
                        'flex-1 py-1 text-[10px] font-bold uppercase rounded-md transition-all',
                        typeof mapping[field] === 'string' || !mapping[field] ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                      )}
                      onClick={() => setSingleMode(field)}
                    >
                      Single
                    </button>
                    <button
                      type="button"
                      className={cn(
                        'flex-1 py-1 text-[10px] font-bold uppercase rounded-md transition-all',
                        typeof mapping[field] !== 'string' && mapping[field] ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
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
                                  'flex items-center gap-2 px-2 py-1.5 rounded-md text-[10px] cursor-pointer transition-colors',
                                  isSelected ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-accent text-muted-foreground hover:text-foreground'
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
                                      : current.filter((c) => c !== col);
                                    updateCombineColumns(field, next);
                                  }}
                                />
                                <div className={cn(
                                  'w-3 h-3 rounded flex items-center justify-center border transition-all duration-200',
                                  isSelected ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/40 bg-background'
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
                          <option value={'\n'}>Newline</option>
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
                    <div className={cn('w-1.5 h-1.5 rounded-full', hasValidEmailMapping ? 'bg-green-500' : 'bg-red-500 animate-pulse')} />
                    Email Mapping Required
                  </li>
                  <li className="flex items-center gap-2 text-xs text-foreground/80">
                    <div className={cn('w-1.5 h-1.5 rounded-full', !hasInvalidCombineConfig ? 'bg-green-500' : 'bg-amber-500')} />
                    Valid Combination Logic
                  </li>
                  <li className="flex items-center gap-2 text-xs text-foreground/80">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    {duplicateMode === 'replace' ? 'Duplicates replace existing leads' : 'Duplicates are skipped safely'}
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

                {hasOperatorSelection && !selectedOperatorId && (
                  <div className="text-[10px] text-amber-400 font-bold uppercase tracking-widest text-center py-2 animate-pulse">
                    Please select an operator
                  </div>
                )}

                <Button
                  onClick={submitImport}
                  disabled={importing || !hasValidEmailMapping || hasInvalidCombineConfig || (hasOperatorSelection && !selectedOperatorId)}
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
                  <div className="text-[10px] font-bold text-yellow-500/70 uppercase tracking-[0.2em] mb-2">
                    {duplicateMode === 'replace' ? 'Duplicate Emails Detected' : 'Duplicate Emails Skipped'}
                  </div>
                  <div className="text-4xl font-black text-yellow-500 tracking-tighter">{importReport.duplicateCount}</div>
                </div>
                <div className="relative group rounded-2xl border border-red-500/30 bg-red-500/5 p-6 text-center transition-all hover:bg-red-500/10 shadow-lg shadow-red-500/5">
                  <div className="text-[10px] font-bold text-red-500/70 uppercase tracking-[0.2em] mb-2">Invalid Format</div>
                  <div className="text-4xl font-black text-red-500 tracking-tighter">{importReport.invalidCount}</div>
                </div>
              </div>

              {typeof importReport.replacedCount === 'number' && importReport.replacedCount > 0 && (
                <div className="rounded-xl border border-primary/30 bg-primary/10 p-3 text-xs text-primary">
                  Replaced existing leads: <span className="font-bold">{importReport.replacedCount}</span> (non-empty uploaded fields only).
                </div>
              )}

              <div className="flex items-center justify-center gap-4 pt-2">
                {importReport.duplicateCount > 0 && (
                  <a
                    className="text-xs font-bold text-yellow-300 hover:text-yellow-200 flex items-center gap-2 px-6 py-2.5 rounded-xl bg-yellow-500/10 border border-yellow-500/20 transition-all hover:scale-105"
                    href={`data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify({
                      reason: 'Email already exists for this operator.',
                      duplicateEmails: importReport.duplicateEmails,
                    }, null, 2))}`}
                    download="duplicate-email-report.json"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" /> Download Duplicate Report
                  </a>
                )}
                {importReport.invalidCount > 0 && (
                  <a
                    className="text-xs font-bold text-red-400 hover:text-red-300 flex items-center gap-2 px-6 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 transition-all hover:scale-105"
                    href={`data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(importReport.invalidRows, null, 2))}`}
                    download="onboarding-error-report.json"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" /> Download Error Log
                  </a>
                )}
                <Link href="/dashboard/leads" className="inline-flex h-10 items-center rounded-xl border border-primary/30 bg-primary/10 px-4 text-xs font-bold text-primary hover:bg-primary/20">
                  Go to Leads
                </Link>
                <Button variant="outline" onClick={() => setImportReport(null)} className="text-xs font-bold px-6 py-2.5 rounded-xl bg-background/20 hover:bg-background/40">
                  Close Report
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
