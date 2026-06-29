export const dynamic = 'force-dynamic';

import { cookies } from 'next/headers';
import { crudServer } from '@/lib/crud-server';
import { resolveRelations } from '@/lib/resolveRelation';
import LeadsClientPage from './LeadClientPage';
import { listLeadFoldersAction } from './actions';
import { buildCrudPageParams, type PageSearchParams } from '@/lib/pagination';

export default async function LeadsPage({ searchParams }: { searchParams: Promise<PageSearchParams> }) {
  const query = await searchParams;
  const cookieStore = await cookies();
  const role = cookieStore.get('user_role')?.value;
  const { params, q } = buildCrudPageParams(query, 50);
  const [page, relations, folders] = await Promise.all([
    crudServer.page('leads', params),
    resolveRelations('leads', role),
    listLeadFoldersAction(),
  ]);
  return (
    <LeadsClientPage
      leads={page.rows}
      relations={relations}
      role={role}
      initialFolders={folders}
      pagination={{ page: page.page, pageSize: page.page_size, total: page.total, query: q }}
    />
  );
}
