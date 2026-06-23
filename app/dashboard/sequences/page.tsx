import DynamicTable from '@/components/dynamic/dynamicTable';
import { serverFetch } from '@/lib/server/server-fetch';
import { resolveRelations } from '@/lib/resolveRelation';
import { cookies } from 'next/headers';
import { isAdminRole } from '@/lib/dashboard-access';

export default async function SequencesPage() {
  const data = await serverFetch<any[]>('/sequences');
  const cookieStore = await cookies();
  const role = cookieStore.get('user_role')?.value;
  const relations = await resolveRelations('sequences', role);

  return (
    <div className="space-y-4">
      {!isAdminRole(role) && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-200">
          Admin-only access for editing.
        </div>
      )}
      <DynamicTable
        table="sequences"
        data={data}
        role={role}
        relations={relations}
      />
    </div>
  );
}
