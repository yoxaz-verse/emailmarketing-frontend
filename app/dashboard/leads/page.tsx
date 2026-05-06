export const dynamic = 'force-dynamic';

import { cookies } from 'next/headers';
import { crudServer } from '@/lib/crud-server';
import { resolveRelations } from '@/lib/resolveRelation';
import LeadsClientPage from './LeadClientPage';
import { listLeadFoldersAction } from './actions';

export default async function LeadsPage() {
  const cookieStore = await cookies();
  const role = cookieStore.get('user_role')?.value;
  const leads = await crudServer.list('leads');
  const relations = await resolveRelations('leads', role);
  const folders = await listLeadFoldersAction();
  return (
    <LeadsClientPage
      leads={leads}
      relations={relations}
      role={role}
      initialFolders={folders}
    />
  );
}
