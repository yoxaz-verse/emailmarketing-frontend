import DynamicTable from '@/components/dynamic/dynamicTable';
import { resolveRelations } from '@/lib/resolveRelation';
import { cookies } from 'next/headers';
import { isAdminRole } from '@/lib/dashboard-access';
import { crudServer } from '@/lib/crud-server';
import { buildCrudPageParams, type PageSearchParams } from '@/lib/pagination';

export default async function SequencesPage({ searchParams }: { searchParams: Promise<PageSearchParams> }) {
  const query = await searchParams;
  const cookieStore = await cookies();
  const role = cookieStore.get('user_role')?.value;
  const { params, q } = buildCrudPageParams(query);
  const [page, relations] = await Promise.all([
    crudServer.page('sequences', params),
    resolveRelations('sequences', role),
  ]);

  return (
    <div className="space-y-4">
      {!isAdminRole(role) && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-200">
          Admin-only access for editing.
        </div>
      )}
      <DynamicTable
        table="sequences"
        data={page.rows}
        role={role}
        relations={relations}
        pagination={{ page: page.page, pageSize: page.page_size, total: page.total, query: q }}
      />
    </div>
  );
}
