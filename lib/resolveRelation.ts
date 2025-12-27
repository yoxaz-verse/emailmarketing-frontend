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
        relations[tableName] = await serverFetch(
          `/crud/${tableName}`
        );
      }
    }
  }

  return relations;
}
