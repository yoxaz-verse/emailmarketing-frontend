import { serverFetch } from '@/lib/server-fetch';
import { tableConfig } from '@/config/tableFields';

export type RelationMap = Record<string, any[]>;

export async function resolveRelations(
  table: string
): Promise<RelationMap> {
  const fields = tableConfig[table] ?? [];
  const relations: RelationMap = {};

  for (const field of fields) {
    if (field.type === 'relation' && field.relation) {
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

        relations[tableName] = await serverFetch(
          `/crud/${tableName}?${params.toString()}`
        );
      }
    }
  }

  return relations;
}
