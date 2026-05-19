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

  if (table === 'campaigns' && isAdmin) {
    const hasOperatorField = fields.some(
      (field) =>
        field.type === 'relation' &&
        field.key === 'operator_id' &&
        field.inForm &&
        (!field.adminOnly || isAdmin)
    );

    if (hasOperatorField && !relations.users) {
      try {
        relations.users = await serverFetch('/crud/users');
      } catch (error) {
        console.warn('[resolveRelations] Failed to load users relation for campaigns', {
          sourceTable: table,
          relationTable: 'users',
          error,
        });
        relations.users = [];
      }
    }
  }

  return relations;
}
