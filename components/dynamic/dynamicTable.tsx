'use client';

import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';

import { tableConfig } from '@/config/tableFields';
import { tableMeta } from '@/config/tableMeta';

import ActionRenderer from './ActionRenderer';
import BadgeRenderer from './elements/badgeRenderer';
import AddEditModal from './AddEditModal';
import DeleteModal from './DeleteModal';
import { RelationMap } from '@/lib/resolveRelation';

type Props = {
  table: string;
  data: any[];
  relations?: RelationMap;
  role?: string;
};

export default function DynamicTable({
  table,
  data,
  relations = {},
  role,
}: Props) {
  const fields = tableConfig[table] ?? [];
  const meta = tableMeta[table] ?? {};
  const actions = meta.actions ?? [];
  const visibleFields = fields.filter((f) => f.inTable);

  const [showForm, setShowForm] = useState(false);
  const [editingRow, setEditingRow] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold capitalize">
          {table.replace('_', ' ')}
        </h2>

        {meta.allowCreate !== false && (
          <Button
            size="sm"
            onClick={() => {
              setEditingRow(null);
              setShowForm(true);
            }}
          >
            Add {table}
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              {visibleFields.map((f) => (
                <TableHead key={f.key}>{f.label}</TableHead>
              ))}
              {(actions.length > 0 ||
                meta.allowEdit !== false ||
                meta.allowDelete !== false) && (
                <TableHead className="text-right">Actions</TableHead>
              )}
            </TableRow>
          </TableHeader>

          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={visibleFields.length + 1}
                  className="text-center text-sm text-muted-foreground"
                >
                  No data found
                </TableCell>
              </TableRow>
            ) : (
              data.map((row) => (
                <TableRow key={row.id}>
                  {visibleFields.map((f) => {
                    let displayValue: React.ReactNode = '—';

                    if (f.badge) {
                      return (
                        <TableCell key={f.key}>
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
                      displayValue = row[f.key] ?? '—';
                    }

                    return (
                      <TableCell key={f.key}>
                        <span className="text-sm">{displayValue}</span>
                      </TableCell>
                    );
                  })}

                  <TableCell className="text-right space-x-2">
                    {meta.allowEdit !== false && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingRow(row);
                          setShowForm(true);
                        }}
                      >
                        Edit
                      </Button>
                    )}

                    {meta.allowDelete !== false && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setDeleteId(row.id)}
                      >
                        Delete
                      </Button>
                    )}

                    {actions.length > 0 && (
                      <ActionRenderer actions={actions} row={row} />
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add / Edit */}
      {showForm && (
        <AddEditModal
          table={table}
          row={editingRow}
          relations={relations}
          role={role}
          onClose={() => setShowForm(false)}
          onSuccess={refresh}
        />
      )}

      {/* Delete */}
      {deleteId && (
        <DeleteModal
          table={table}
          id={deleteId}
          onClose={() => setDeleteId(null)}
          onSuccess={refresh}
        />
      )}
    </div>
  );
}
