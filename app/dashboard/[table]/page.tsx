// app/dashboard/[table]/page.tsx
import DynamicTable from '@/components/dynamic/dynamicTable';
import { tableConfig } from '@/config/tableFields';
import { crudServer } from '@/lib/crud-server';
import { resolveRelations } from '@/lib/resolveRelation';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { isAdminRole } from '@/lib/dashboard-access';
import { buildCrudPageParams, type PageSearchParams } from '@/lib/pagination';

export const dynamic = 'force-dynamic';

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ table: string }>;
  searchParams: Promise<PageSearchParams>;
}) {
  const { table } = await params;
  const query = await searchParams;
  if (!tableConfig[table]) {
    notFound();
  }
  const cookieStore = await cookies(); // ✅ FIX
  const role = cookieStore.get('user_role')?.value;
  const isAdmin = isAdminRole(role);
  if (!isAdmin && table !== 'campaign_leads') {
    redirect('/dashboard');
  }
  const { params: pageParams, q } = buildCrudPageParams(query);
  const [relations, page] = await Promise.all([
    resolveRelations(table, role),
    crudServer.page(table, pageParams),
  ]);

  return (
    <DynamicTable
      table={table}
      data={page.rows}
      role={role}
      relations={relations}
      pagination={{ page: page.page, pageSize: page.page_size, total: page.total, query: q }}
    />
  );
}
