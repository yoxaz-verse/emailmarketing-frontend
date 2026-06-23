import DynamicTable from '@/components/dynamic/dynamicTable';
import { serverFetch } from '@/lib/server/server-fetch';
import { cookies } from 'next/headers';
import { isAdminRole } from '@/lib/dashboard-access';

export default async function SequenceDetailPage({
  params,
}: {
  params: Promise<{ sequenceId: string }>;
}) {
  const { sequenceId } = await params;
  const cookieStore = await cookies();
  const role = cookieStore.get('user_role')?.value;
  const isAdmin = isAdminRole(role);

  const data = await serverFetch<any[]>(
    `/crud/sequence_steps?sequence_id=${sequenceId}`
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Sequence Steps</h1>
        <p className="text-sm text-muted-foreground">
          {isAdmin ? 'Manage the message steps for this sequence.' : 'Read-only sequence steps. Only admin can edit.'}
        </p>
      </div>
      {!isAdmin && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-200">
          Admin-only access for editing.
        </div>
      )}
      <DynamicTable
        table="sequence_steps"
        data={data}
        role={role}
        defaultValues={{ sequence_id: sequenceId }}
      />
    </div>
  );
}
