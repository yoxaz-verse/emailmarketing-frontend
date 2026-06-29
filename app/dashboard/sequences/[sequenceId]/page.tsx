import DynamicTable from '@/components/dynamic/dynamicTable';
import { cookies } from 'next/headers';
import { isAdminRole } from '@/lib/dashboard-access';
import { crudServer } from '@/lib/crud-server';
import { buildCrudPageParams, type PageSearchParams } from '@/lib/pagination';

export default async function SequenceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ sequenceId: string }>;
  searchParams: Promise<PageSearchParams>;
}) {
  const { sequenceId } = await params;
  const query = await searchParams;
  const cookieStore = await cookies();
  const role = cookieStore.get('user_role')?.value;
  const isAdmin = isAdminRole(role);

  const { params: pageParams, q } = buildCrudPageParams(query);
  pageParams.set('sequence_id', sequenceId);
  const page = await crudServer.page('sequence_steps', pageParams);

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
        data={page.rows}
        role={role}
        defaultValues={{ sequence_id: sequenceId }}
        pagination={{ page: page.page, pageSize: page.page_size, total: page.total, query: q }}
      />
    </div>
  );
}
