export const dynamic = 'force-dynamic';

import { cookies } from 'next/headers';
import { crudServer } from '@/lib/crud-server';
import { resolveRelations } from '@/lib/resolveRelation';
import LeadsClientPage from './LeadClientPage';

export default async function LeadsPage() {
  const leads = await crudServer.list('leads');
  const relations = await resolveRelations('leads');
  const cookieStore = await cookies(); // ✅ FIX
  const role = cookieStore.get('user_role')?.value;
  return (
    <LeadsClientPage
      leads={leads}
      relations={relations}
      role={role}
    />
  );
}
