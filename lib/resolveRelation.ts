import { serverFetch } from '@/lib/server/server-fetch';
import { tableConfig } from '@/config/tableFields';

export type RelationMap = Record<string, any[]>;

export async function resolveRelations(
  table: string,
  role?: string
): Promise<RelationMap> {
  const fields = tableConfig[table] ?? [];
  const relations: RelationMap = {};

  for (const field of fields) {
    if (field.type === 'relation' && field.relation) {
      if (field.adminOnly && role !== 'admin' && role !== 'superadmin') {
        continue;
      }
      const tableName = field.relation.table;

      if (!relations[tableName]) {
        const params = new URLSearchParams();

        // ✅ FLATTEN STATIC FILTERS (same contract as backend)
        if (field.relation.filters) {
          for (const [key, value] of Object.entries(
            field.relation.filters
          )) {
            params.set(key, String(value));
          }
        }

        try {
          relations[tableName] = await serverFetch(
            `/crud/${tableName}?${params.toString()}`
          );
        } catch (error) {
          console.warn('[resolveRelations] Failed to load relation, using [] fallback', {
            sourceTable: table,
            relationTable: tableName,
            relationField: field.key,
            error,
          });
          relations[tableName] = [];
        }
      }
    }
  }

  return relations;
}
