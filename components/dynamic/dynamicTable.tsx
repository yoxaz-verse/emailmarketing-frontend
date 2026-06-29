'use client';

import { useState, useMemo, useEffect, useRef, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { createPortal } from 'react-dom';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  Filter,
  Download,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'react-hot-toast';

import { tableConfig } from '@/config/tableFields';
import { tableMeta } from '@/config/tableMeta';

import ActionRenderer from './ActionRenderer';
import BadgeRenderer from './elements/badgeRenderer';
import AddEditModal from './AddEditModal';
import DeleteModal from './DeleteModal';
import { bulkDeleteRows } from './action';
import { RelationMap } from '@/lib/resolveRelation';
import { cn } from '@/lib/utils';
import { isAdminRole } from '@/lib/dashboard-access';

type Props = {
  table: string;
  data: any[];
  relations?: RelationMap;
  role?: string;
  defaultValues?: Record<string, any>;
  onSelectionChange?: (ids: string[]) => void;
  onFilterToggle?: () => void;
  showFilterButton?: boolean;
  exportFilename?: string;
  bulkFolderOptions?: Array<{ id: string; name: string }>;
  onBulkAssignFolder?: (ids: string[], folderId: string) => Promise<{ inserted?: number } | void>;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    query?: string;
  };
};

const MAX_CHAR_LENGTH = 40;
const EMPTY_DEFAULT_VALUES: Record<string, any> = {};

function truncate(value: any, max = MAX_CHAR_LENGTH) {
  if (typeof value !== 'string') return value;
  if (value.length <= max) return value;
  return value.slice(0, max) + '...';
}

function formatUtcDateTime(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hour = String(date.getUTCHours()).padStart(2, '0');
  const minute = String(date.getUTCMinutes()).padStart(2, '0');

  return `${year}-${month}-${day} ${hour}:${minute} UTC`;
}

function formatDisplayValue(field: any, rawValue: any): any {
  if (rawValue == null || rawValue === '') return '—';

  if (field?.type === 'dateTime') {
    const parsed = new Date(rawValue);
    if (Number.isNaN(parsed.getTime())) return rawValue;
    return formatUtcDateTime(parsed);
  }

  return rawValue;
}

export default function DynamicTable({
  table,
  data,
  relations = {},
  role,
  defaultValues = EMPTY_DEFAULT_VALUES,
  onSelectionChange,
  onFilterToggle,
  showFilterButton = false,
  exportFilename,
  bulkFolderOptions = [],
  onBulkAssignFolder,
  pagination,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const urlSearchParams = useSearchParams();
  const fields = tableConfig[table] ?? [];
  const meta = tableMeta[table] ?? {};
  const isAdmin = isAdminRole(role);
  const isSequenceTable = table === 'sequences' || table === 'sequence_steps';
  const sequenceReadOnlyForOperator = isSequenceTable && !isAdmin;
  const actions = sequenceReadOnlyForOperator
    ? (meta.actions ?? []).filter((action) => action.key === 'viewSequence')
    : (meta.actions ?? []).filter((action) => !action.adminOnly || isAdmin);
  const bulkActions = meta.bulkActions ?? [];
  const allowCreate = sequenceReadOnlyForOperator ? false : meta.allowCreate !== false;
  const allowEdit = sequenceReadOnlyForOperator ? false : meta.allowEdit !== false;
  const allowDelete = sequenceReadOnlyForOperator ? false : meta.allowDelete !== false;
  const hasActionColumn = actions.length > 0 || allowEdit || allowDelete;
  const visibleFields = useMemo(() => fields.filter((f) => f.inTable), [fields]);

  const [showForm, setShowForm] = useState(false);
  const [editingRow, setEditingRow] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [pendingRowActionId, setPendingRowActionId] = useState<string | null>(null);
  const [pendingActionType, setPendingActionType] = useState<'edit' | 'delete' | null>(null);
  const [isModalSubmitting, setIsModalSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState(pagination?.query ?? '');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkPending, startBulkTransition] = useTransition();
  const [bulkFolderId, setBulkFolderId] = useState('');
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(pagination?.page ?? 1);
  const pageSize = pagination?.pageSize ?? 25;
  const usesServerPagination = Boolean(pagination);

  useEffect(() => {
    if (!pagination) return;
    setCurrentPage(pagination.page);
    setSearchQuery(pagination.query ?? '');
  }, [pagination?.page, pagination?.query]);

  useEffect(() => {
    if (!usesServerPagination || searchQuery === (pagination?.query ?? '')) return;
    const timeout = window.setTimeout(() => {
      const params = new URLSearchParams(urlSearchParams.toString());
      if (searchQuery.trim()) params.set('q', searchQuery.trim());
      else params.delete('q');
      params.set('page', '1');
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [pagination?.query, pathname, router, searchQuery, urlSearchParams, usesServerPagination]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const filteredData = useMemo(() => {
    let result = data;
    if (usesServerPagination) return result;
    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      result = data.filter((row) => {
        return visibleFields.some((f) => {
          const value = row[f.key];
          return String(value).toLowerCase().includes(lowerQuery);
        });
      });
    }
    return result;
  }, [data, searchQuery, visibleFields, usesServerPagination]);

  const selectableIds = useMemo(
    () =>
      filteredData
        .map((row) => row?.id)
        .filter((id): id is string => typeof id === 'string' && id.trim().length > 0),
    [filteredData]
  );

  const selectionEnabled = selectableIds.length === filteredData.length && filteredData.length > 0;

  useEffect(() => {
    if (!selectionEnabled) {
      setSelectedIds(new Set());
      return;
    }
    const validIds = new Set(selectableIds);
    setSelectedIds((prev) => {
      const next = new Set<string>();
      for (const id of prev) {
        if (validIds.has(id)) next.add(id);
      }
      return next;
    });
  }, [selectableIds, selectionEnabled]);

  // Paginated Data
  const paginatedData = useMemo(() => {
    if (usesServerPagination) return filteredData;
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage, pageSize, usesServerPagination]);

  const totalRecords = pagination?.total ?? filteredData.length;
  const totalPages = Math.ceil(totalRecords / pageSize);
  const startRecord = totalRecords === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endRecord = totalRecords === 0 ? 0 : Math.min(currentPage * pageSize, totalRecords);
  const selectedCount = selectedIds.size;
  const allSelected = selectionEnabled && selectableIds.length > 0 && selectedCount === selectableIds.length;
  const partiallySelected = selectionEnabled && selectedCount > 0 && selectedCount < selectableIds.length;

  const headerCheckboxRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    onSelectionChange?.(Array.from(selectedIds));
  }, [onSelectionChange, selectedIds]);

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = partiallySelected;
    }
  }, [partiallySelected]);

  function toggleRowSelection(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleSelectAll(checked: boolean) {
    if (!selectionEnabled) return;
    if (checked) {
      setSelectedIds(new Set(selectableIds));
      return;
    }
    setSelectedIds(new Set());
  }

  function refresh() {
    router.refresh();
  }

  function goToPage(nextPage: number) {
    const safePage = Math.max(1, Math.min(Math.max(totalPages, 1), nextPage));
    if (!usesServerPagination) {
      setCurrentPage(safePage);
      return;
    }
    const params = new URLSearchParams(urlSearchParams.toString());
    params.set('page', String(safePage));
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function handleBulkDelete(confirmText?: string) {
    if (selectedCount === 0) return;
    const shouldProceed = window.confirm(
      confirmText ?? `Delete ${selectedCount} selected record(s)? This action cannot be undone.`
    );
    if (!shouldProceed) return;

    startBulkTransition(async () => {
      try {
        const result = await bulkDeleteRows(table, Array.from(selectedIds));
        const filtered = Number(result.filteredCount ?? 0);
        if (filtered > 0) {
          toast.success(`Deleted ${result.deletedCount} record(s). ${filtered} were skipped due to scope or missing rows.`);
        } else {
          toast.success(`Deleted ${result.deletedCount} record(s).`);
        }
        setSelectedIds(new Set());
        refresh();
      } catch (error: any) {
        toast.error(error?.message || 'Bulk delete failed');
      }
    });
  }

  function handleBulkAssignFolder() {
    if (!onBulkAssignFolder) return;
    if (selectedCount === 0) return;
    if (!bulkFolderId) {
      toast.error('Choose a folder first');
      return;
    }

    startBulkTransition(async () => {
      try {
        const result = await onBulkAssignFolder(Array.from(selectedIds), bulkFolderId);
        const assigned = Number(result && typeof result === 'object' ? (result as { inserted?: number }).inserted ?? selectedCount : selectedCount);
        toast.success(`Moved ${assigned} lead(s) to folder.`);
        setSelectedIds(new Set());
        setBulkFolderId('');
        refresh();
      } catch (error: any) {
        toast.error(error?.message || 'Failed to move selected leads');
      }
    });
  }

  function resolveRelationValue(row: any, field: any) {
    if (!field.relation) return '—';

    const foreignKeyValue = row[field.key];
    if (!foreignKeyValue) return '—';

    const relatedRows = relations[field.relation.table] ?? [];
    const match = relatedRows.find(
      (r: any) => r[field.relation.valueKey] === foreignKeyValue
    );

    if (!match && field.relation.table === 'sequences') {
      const fallbackId = String(foreignKeyValue);
      return `Sequence ${fallbackId.slice(0, 8)}`;
    }

    return match?.[field.relation.labelKey] ?? '—';
  }

  function escapeCsv(value: unknown): string {
    if (value == null) return '';
    const text = String(value);
    if (/[",\n]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  }

  function buildCsvRows(rows: any[]): string {
    const headers = visibleFields.map((f) => escapeCsv(f.label)).join(',');
    const body = rows
      .map((row) =>
        visibleFields
          .map((f) => {
            if (f.badge) return escapeCsv(Boolean(row[f.key]));
            if (f.type === 'relation') return escapeCsv(resolveRelationValue(row, f));
            return escapeCsv(formatDisplayValue(f, row[f.key]));
          })
          .join(',')
      )
      .join('\n');
    return `${headers}\n${body}`;
  }

  function handleExportCsv() {
    if (usesServerPagination) {
      const params = new URLSearchParams(urlSearchParams.toString());
      params.delete('page');
      const link = document.createElement('a');
      link.href = `/api/proxy/crud/${encodeURIComponent(table)}/export?${params.toString()}`;
      link.setAttribute('download', `${exportFilename || table}-export.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      return;
    }
    const csv = buildCsvRows(filteredData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    const base = exportFilename || `${table}-export`;
    link.href = url;
    link.setAttribute('download', `${base}-${stamp}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      {/* Header & Controls Redesign */}
      <div className="flex flex-col gap-3 mb-3">
        {/* Top Tier: Title & Primary Actions */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h2 className="text-3xl font-black tracking-tighter text-foreground capitalize">
                {table.replace('_', ' ')}
              </h2>
              <div className="px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-black uppercase tracking-widest dark:shadow-sm">
                {totalRecords} {totalRecords === 1 ? 'Record' : 'Records'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {allowCreate && (
              <Button
                size="sm"
                className="h-10 gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs px-5 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] dark:shadow-xl dark:shadow-primary/20"
                onClick={() => {
                  setPendingRowActionId(null);
                  setPendingActionType(null);
                  setEditingRow(null);
                  setShowForm(true);
                }}
              >
                <Plus className="h-4 w-4" /> Add Record
              </Button>
            )}
          </div>
        </div>

        {/* Bottom Tier: Toolbar & Search */}
        <div className="flex flex-col md:flex-row items-center gap-4 bg-card/30 backdrop-blur-xl border border-border/40 p-2 rounded-2xl dark:shadow-inner">
          <div className="relative flex-1 group w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input
              placeholder={`Search ${table.replace('_', ' ')}...`}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-11 w-full h-11 bg-transparent border-none focus-visible:ring-0 text-sm font-medium placeholder:text-muted-foreground/60"
            />
          </div>

          <div className="flex items-center gap-2 pr-2 w-full md:w-auto">
            {selectedCount > 0 && (
              <div className="h-9 flex items-center gap-3 px-3 rounded-xl bg-primary/10 border border-primary/20 animate-in fade-in zoom-in-95 duration-300">
                <span className="text-[10px] font-black uppercase tracking-widest text-primary">
                  {selectedCount} Selected
                </span>
                <div className="w-px h-3 bg-primary/20" />
                <button 
                  onClick={() => setSelectedIds(new Set())}
                  className="text-[10px] font-black uppercase tracking-widest text-primary hover:text-white transition-colors"
                >
                  Clear
                </button>
              </div>
            )}

            {bulkActions.length > 0 && selectedCount > 0 && (
              <div className="flex items-center gap-2 animate-in slide-in-from-right-4 duration-300">
                {bulkActions.map((bulkAction) => {
                  if (bulkAction.key === 'bulkAssignFolder') {
                    const canAssign = bulkFolderOptions.length > 0 && bulkFolderId.length > 0 && Boolean(onBulkAssignFolder);
                    return (
                      <div key={bulkAction.key} className="flex items-center gap-2">
                        <select
                          className="h-9 rounded-xl border border-border/60 bg-background/40 px-3 text-[11px] font-bold uppercase tracking-wider text-foreground focus:ring-2 focus:ring-primary/20 outline-none transition-all dark:shadow-inner"
                          value={bulkFolderId}
                          onChange={(e) => setBulkFolderId(e.target.value)}
                          disabled={isBulkPending || bulkFolderOptions.length === 0 || !onBulkAssignFolder}
                        >
                          <option value="">Folder...</option>
                          {bulkFolderOptions.map((folder) => (
                            <option key={folder.id} value={folder.id}>
                              {folder.name}
                            </option>
                          ))}
                        </select>
                        <Button
                          variant={bulkAction.variant ?? 'outline'}
                          size="sm"
                          className="h-9 font-bold text-[10px] uppercase tracking-widest px-3 rounded-xl"
                          disabled={isBulkPending || !canAssign}
                          onClick={handleBulkAssignFolder}
                        >
                          {isBulkPending ? <Loader2 className="h-4 w-4 animate-spin" /> : `${bulkAction.label}`}
                        </Button>
                      </div>
                    );
                  }

                  return (
                    <Button
                      key={bulkAction.key}
                      variant={bulkAction.variant ?? 'outline'}
                      size="sm"
                      className="h-9 font-bold text-[10px] uppercase tracking-widest px-3 rounded-xl dark:shadow-lg dark:shadow-destructive/10"
                      disabled={isBulkPending}
                      onClick={() => {
                        if (bulkAction.key === 'bulkDelete') {
                          handleBulkDelete(bulkAction.confirmText);
                        }
                      }}
                    >
                      {isBulkPending && bulkAction.key === 'bulkDelete' ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Deleting...
                        </>
                      ) : (
                        bulkAction.label
                      )}
                    </Button>
                  );
                })}
              </div>
            )}
            
            <div className="h-6 w-px bg-border/40 hidden md:block" />

            {showFilterButton && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-9 gap-2 text-xs font-bold uppercase tracking-wider hover:bg-primary/10 hover:text-primary transition-all rounded-xl"
                onClick={onFilterToggle}
              >
                <Filter className="h-3.5 w-3.5" /> Filter
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              className="h-9 w-9 p-0 hover:bg-primary/10 hover:text-primary transition-all rounded-xl"
              onClick={refresh}
              aria-label={table === 'leads' ? 'Refresh leads' : 'Refresh'}
              title="Refresh"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
            
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-9 gap-2 text-xs font-bold uppercase tracking-wider hover:bg-primary/10 hover:text-primary transition-all rounded-xl hidden lg:flex"
              onClick={handleExportCsv}
            >
              <Download className="h-3.5 w-3.5" /> {usesServerPagination ? 'Export all' : 'Export page'}
            </Button>
          </div>
        </div>
      </div>

      {/* Table Container Redesign */}
      <div className="rounded-3xl border border-border/40 bg-card/20 backdrop-blur-md overflow-hidden transition-all duration-500 dark:shadow-2xl">
        <div className="overflow-x-auto min-h-[400px] custom-scrollbar">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="hover:bg-transparent border-b border-border/40">
                <TableHead className="h-11 text-xs font-bold text-muted-foreground uppercase tracking-wider py-3 px-4 w-12">
                  <input
                    ref={headerCheckboxRef}
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) => toggleSelectAll(e.target.checked)}
                    disabled={!selectionEnabled}
                    aria-label="Select all rows"
                    className="h-4 w-4 rounded border-border bg-card accent-primary disabled:opacity-40"
                  />
                </TableHead>
                {visibleFields.map((f) => (
                  <TableHead key={f.key} className="h-11 text-xs font-bold text-muted-foreground uppercase tracking-wider py-3 px-4">
                    {f.label}
                  </TableHead>
                ))}
                {hasActionColumn && (
                    <TableHead className="h-11 text-right text-xs font-bold text-muted-foreground uppercase tracking-wider py-3 px-4">
                      Actions
                    </TableHead>
                  )}
              </TableRow>
            </TableHeader>

            <TableBody>
              {paginatedData.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={visibleFields.length + 1 + (hasActionColumn ? 1 : 0)}
                    className="h-64 text-center text-sm text-muted-foreground italic"
                  >
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Search className="h-8 w-8 text-muted-foreground/40" />
                      {searchQuery ? `No results found for "${searchQuery}"` : "No data available"}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedData.map((row) => (
                  <TableRow key={row.id} className="group hover:bg-muted/50 transition-colors border-b border-border last:border-none">
                    <TableCell className="py-3 px-4">
                      <input
                        type="checkbox"
                        checked={typeof row?.id === 'string' ? selectedIds.has(row.id) : false}
                        onChange={(e) => {
                          if (typeof row?.id === 'string') {
                            toggleRowSelection(row.id, e.target.checked);
                          }
                        }}
                        disabled={typeof row?.id !== 'string' || !selectionEnabled}
                        aria-label={`Select row ${row?.id ?? ''}`}
                        className="h-4 w-4 rounded border-border bg-card accent-primary disabled:opacity-40"
                      />
                    </TableCell>
                    {visibleFields.map((f) => {
                      let displayValue: React.ReactNode = '—';

                      if (f.badge) {
                        return (
                          <TableCell key={f.key} className="py-3 px-4">
                            <BadgeRenderer
                              config={f.badge}
                              value={Boolean(row[f.key])}
                            />
                          </TableCell>
                        );
                      }

                      if (f.type === 'relation') {
                        displayValue = resolveRelationValue(row, f);
                      } else {
                        displayValue = formatDisplayValue(f, row[f.key]);
                      }

                      return (
                        <TableCell key={f.key} className="py-3 px-4">
                          <span className={cn(
                            "text-sm font-medium text-foreground",
                            f.key === 'name' || f.key === 'title' ? "font-semibold" : ""
                          )}>
                            {truncate(displayValue)}
                          </span>
                        </TableCell>
                      );
                    })}

                    {hasActionColumn && (
                      <TableCell className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-100">
                    {allowEdit && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-muted-foreground/70 hover:text-primary hover:bg-primary/10"
                              disabled={
                                isModalSubmitting ||
                                (pendingRowActionId === row.id && pendingActionType === 'edit')
                              }
                              onClick={() => {
                                setPendingRowActionId(row.id);
                                setPendingActionType('edit');
                                setEditingRow(row);
                                setShowForm(true);
                              }}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          )}

                    {allowDelete && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-muted-foreground/70 hover:text-red-700 dark:text-red-400 hover:bg-red-500/10"
                              disabled={
                                isModalSubmitting ||
                                (pendingRowActionId === row.id && pendingActionType === 'delete')
                              }
                              onClick={() => {
                                setPendingRowActionId(row.id);
                                setPendingActionType('delete');
                                setDeleteId(row.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}

                          {actions.length > 0 && (
                            <div className="pl-1 border-l ml-1 border-border">
                              <ActionRenderer actions={actions} row={row} />
                            </div>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Footer / Pagination Redesign */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-4 px-2 border-t border-border/40">
        <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
          <div>
            Showing <span className="text-foreground">{startRecord}</span> to <span className="text-foreground">{endRecord}</span>
          </div>
          <div className="w-1 h-1 rounded-full bg-border" />
          <div>
            <span className="text-foreground">{totalRecords}</span> Total Records
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage === 1}
            className="h-9 px-4 rounded-xl text-[10px] font-black uppercase tracking-[0.1em] hover:bg-primary/10 hover:text-primary disabled:opacity-30 transition-all"
          >
            Previous
          </Button>
          
          <div className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-background/40 border border-border/40 font-mono text-[10px] font-bold dark:shadow-inner">
            <span className="text-primary">{currentPage}</span>
            <span className="text-muted-foreground/40 mx-1">/</span>
            <span className="text-muted-foreground">{totalPages || 1}</span>
          </div>

          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage === totalPages || totalPages === 0}
            className="h-9 px-4 rounded-xl text-[10px] font-black uppercase tracking-[0.1em] hover:bg-primary/10 hover:text-primary disabled:opacity-30 transition-all"
          >
            Next
          </Button>
        </div>
      </div>

      {/* Portals for Modals */}
      {mounted && typeof document !== 'undefined' && (
        <>
          {showForm && createPortal(
            <AddEditModal
              table={table}
              row={editingRow}
              relations={relations}
              role={role}
              onClose={() => {
                if (isModalSubmitting) return;
                setShowForm(false);
                setPendingRowActionId(null);
                setPendingActionType(null);
              }}
              onSuccess={refresh}
              defaultValues={defaultValues}
              onSubmittingChange={(submitting) => setIsModalSubmitting(submitting)}
            />,
            document.body
          )}

          {deleteId && createPortal(
            <DeleteModal
              table={table}
              id={deleteId}
              onClose={() => {
                if (isModalSubmitting) return;
                setDeleteId(null);
                setPendingRowActionId(null);
                setPendingActionType(null);
              }}
              onSuccess={refresh}
              onSubmittingChange={(submitting) => setIsModalSubmitting(submitting)}
            />,
            document.body
          )}
        </>
      )}
    </div>
  );
}
