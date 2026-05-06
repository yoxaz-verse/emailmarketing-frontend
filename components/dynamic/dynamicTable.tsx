'use client';

import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  MoreVertical,
  Filter,
  Download
} from 'lucide-react';

import { tableConfig } from '@/config/tableFields';
import { tableMeta } from '@/config/tableMeta';

import ActionRenderer from './ActionRenderer';
import BadgeRenderer from './elements/badgeRenderer';
import AddEditModal from './AddEditModal';
import DeleteModal from './DeleteModal';
import { RelationMap } from '@/lib/resolveRelation';
import { cn } from '@/lib/utils';

type Props = {
  table: string;
  data: any[];
  relations?: RelationMap;
  role?: string;
  defaultValues?: Record<string, any>
};

const MAX_CHAR_LENGTH = 40;

function truncate(value: any, max = MAX_CHAR_LENGTH) {
  if (typeof value !== 'string') return value;
  if (value.length <= max) return value;
  return value.slice(0, max) + '...';
}

function formatDisplayValue(field: any, rawValue: any): any {
  if (rawValue == null || rawValue === '') return '—';

  if (field?.type === 'dateTime') {
    const parsed = new Date(rawValue);
    if (Number.isNaN(parsed.getTime())) return rawValue;
    return parsed.toLocaleString(undefined, {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  }

  return rawValue;
}

export default function DynamicTable({
  table,
  data,
  relations = {},
  role,
  defaultValues = {},
}: Props) {
  const fields = tableConfig[table] ?? [];
  const meta = tableMeta[table] ?? {};
  const actions = meta.actions ?? [];
  const visibleFields = fields.filter((f) => f.inTable);

  const [showForm, setShowForm] = useState(false);
  const [editingRow, setEditingRow] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const filteredData = useMemo(() => {
    let result = data;
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
  }, [data, searchQuery, visibleFields]);

  // Paginated Data
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage]);

  const totalPages = Math.ceil(filteredData.length / pageSize);

  function refresh() {
    window.location.reload();
  }

  function resolveRelationValue(row: any, field: any) {
    if (!field.relation) return '—';

    const foreignKeyValue = row[field.key];
    if (!foreignKeyValue) return '—';

    const relatedRows = relations[field.relation.table] ?? [];
    const match = relatedRows.find(
      (r: any) => r[field.relation.valueKey] === foreignKeyValue
    );

    return match?.[field.relation.labelKey] ?? '—';
  }

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground capitalize flex items-center gap-2">
            {table.replace('_', ' ')}
            <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-bold">
              {data.length}
            </Badge>
          </h2>
          <p className="text-sm text-muted-foreground">Manage {table.replace('_', ' ')} records and data.</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-blue-400 transition-colors" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1); // Reset to first page on search
              }}
              className="pl-9 w-[200px] lg:w-[300px] h-9 bg-card border-border focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg text-sm"
            />
          </div>

          <Button variant="outline" size="sm" className="h-9 gap-2 hidden lg:flex border-border hover:bg-muted">
            <Filter className="h-4 w-4" /> Filter
          </Button>

          {meta.allowCreate !== false && (
            <Button
              size="sm"
              className="h-9 gap-2 bg-blue-600 hover:bg-blue-700 shadow-sm"
              onClick={() => {
                setEditingRow(null);
                setShowForm(true);
              }}
            >
              <Plus className="h-4 w-4" /> Add Record
            </Button>
          )}
        </div>
      </div>

      {/* Table Container */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto min-h-[400px]">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="hover:bg-transparent border-b border-border">
                {visibleFields.map((f) => (
                  <TableHead key={f.key} className="h-11 text-xs font-bold text-muted-foreground uppercase tracking-wider py-3 px-4">
                    {f.label}
                  </TableHead>
                ))}
                {(actions.length > 0 ||
                  meta.allowEdit !== false ||
                  meta.allowDelete !== false) && (
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
                    colSpan={visibleFields.length + 1}
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

                    <TableCell className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {meta.allowEdit !== false && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-muted-foreground hover:text-blue-300 hover:bg-blue-500/10"
                            onClick={() => {
                              setEditingRow(row);
                              setShowForm(true);
                            }}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        )}

                        {meta.allowDelete !== false && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
                            onClick={() => setDeleteId(row.id)}
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
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Footer / Pagination */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-2">
        <p>
          Showing <span className="font-bold text-foreground">{(currentPage - 1) * pageSize + 1}</span> to <span className="font-bold text-foreground">{Math.min(currentPage * pageSize, filteredData.length)}</span> of <span className="font-bold text-foreground">{filteredData.length}</span> records
        </p>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className="h-8 text-[10px] px-3 uppercase font-bold tracking-tight"
          >
            Previous
          </Button>
          <div className="flex items-center px-4 bg-muted/30 rounded-lg font-mono text-[10px]">
            Page {currentPage} of {totalPages || 1}
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages || totalPages === 0}
            className="h-8 text-[10px] px-3 uppercase font-bold tracking-tight"
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
              onClose={() => setShowForm(false)}
              onSuccess={refresh}
              defaultValues={defaultValues}
            />,
            document.body
          )}

          {deleteId && createPortal(
            <DeleteModal
              table={table}
              id={deleteId}
              onClose={() => setDeleteId(null)}
              onSuccess={refresh}
            />,
            document.body
          )}
        </>
      )}
    </div>
  );
}
