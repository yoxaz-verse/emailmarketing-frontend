import DynamicTable from '@/components/dynamic/dynamicTable';
import { serverFetch } from '@/lib/server/server-fetch';
import { resolveRelations } from '@/lib/resolveRelation';
import { cookies } from 'next/headers';

export default async function SequencesPage() {
  const data = await serverFetch<any[]>('/sequences');
  const cookieStore = await cookies();
  const role = cookieStore.get('user_role')?.value;
  const relations = await resolveRelations('sequences', role);

  return (
    <DynamicTable
      table="sequences"
      data={data}
      role={role}
      relations={relations}
    />
  );
}
