// app/dashboard/[table]/page.tsx
import DynamicTable from '@/components/dynamic/dynamicTable';
import { crudServer } from '@/lib/crud-server';
import { resolveRelations } from '@/lib/resolveRelation';
import { cookies } from 'next/headers';

export default async function Page({
  params
}: {
  params: Promise<{ table: string }>;
}) {
  const { table } = await params;
  const cookieStore = await cookies(); // ✅ FIX
  const role = cookieStore.get('user_role')?.value;
const relations = await resolveRelations(table);
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
