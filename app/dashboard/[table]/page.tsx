// app/dashboard/[table]/page.tsx
import DynamicTable from '@/components/dynamic/dynamicTable';
import { tableConfig } from '@/config/tableFields';
import { crudServer } from '@/lib/crud-server';
import { resolveRelations } from '@/lib/resolveRelation';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { isAdminRole } from '@/lib/dashboard-access';

export const dynamic = 'force-dynamic';

export default async function Page({
  params
}: {
  params: Promise<{ table: string }>;
}) {
  const { table } = await params;
  if (!tableConfig[table]) {
    notFound();
  }
  const cookieStore = await cookies(); // ✅ FIX
  const role = cookieStore.get('user_role')?.value;
  const isAdmin = isAdminRole(role);
  if (!isAdmin && table !== 'campaign_leads') {
    redirect('/dashboard');
  }
  const relations = await resolveRelations(table, role);
  const data = await crudServer.list(table);

  return (
    <DynamicTable
      table={table}
      data={data}
      role={role}
      relations={relations}
    />
  );
}
