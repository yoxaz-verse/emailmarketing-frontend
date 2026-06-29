import { serverFetch } from '@/lib/server/server-fetch';
import { tableConfig } from '@/config/tableFields';

export type RelationMap = Record<string, any[]>;

export async function resolveRelations(
  table: string,
  role?: string
): Promise<RelationMap> {
  const fields = tableConfig[table] ?? [];
  const relations: RelationMap = {};
  const isAdmin = role === 'admin' || role === 'superadmin';

  const requests = new Map<string, { path: string; fieldKey: string }>();
  for (const field of fields) {
    if (field.type === 'relation' && field.relation) {
      const isOperatorCampaignOperatorField =
        table === 'campaigns' &&
        field.key === 'operator_id' &&
        field.relation.table === 'operators';

      if (field.adminOnly && role !== 'admin' && role !== 'superadmin' && !isOperatorCampaignOperatorField) {
        continue;
      }
      const tableName = field.relation.table;

      if (!requests.has(tableName)) {
        const params = new URLSearchParams();

        // ✅ FLATTEN STATIC FILTERS (same contract as backend)
        if (field.relation.filters) {
          for (const [key, value] of Object.entries(
            field.relation.filters
          )) {
            params.set(key, String(value));
          }
        }

        requests.set(tableName, {
          path: `/crud/${tableName}?${params.toString()}`,
          fieldKey: field.key,
        });
      }
    }
  }

  if (table === 'campaigns' && isAdmin) {
    const hasOperatorField = fields.some(
      (field) =>
        field.type === 'relation' &&
        field.key === 'operator_id' &&
        field.inForm &&
        (!field.adminOnly || isAdmin)
    );

    if (hasOperatorField && !requests.has('users')) {
      requests.set('users', { path: '/crud/users', fieldKey: 'operator_id' });
    }
  }

  await Promise.all(Array.from(requests.entries()).map(async ([tableName, request]) => {
    try {
      relations[tableName] = await serverFetch<any[]>(request.path);
    } catch (error) {
      console.warn('[resolveRelations] Failed to load relation, using [] fallback', {
        sourceTable: table,
        relationTable: tableName,
        relationField: request.fieldKey,
        error,
      });
      relations[tableName] = [];
    }
  }));

  return relations;
}
