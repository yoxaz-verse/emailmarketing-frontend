import { cookies } from 'next/headers';

import UploadLeadsForm from './UploadLeadsForm';
import { serverFetch } from '@/lib/server/server-fetch';

type Operator = { id: string; name: string; region?: string | null };

export default async function UploadLeadsPage() {
  const cookieStore = await cookies();
  const role = cookieStore.get('user_role')?.value;

  let operators: Operator[] = [];
  if (role === 'admin' || role === 'superadmin') {
    try {
      operators = await serverFetch('/crud/operators?limit=500');
    } catch {
      operators = [];
    }
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-10">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold tracking-tight">Bulk Upload</h2>
        <p className="text-sm text-muted-foreground">Dedicated ingestion workspace for lead imports and mapping.</p>
      </div>
      <UploadLeadsForm role={role} operators={operators} />
    </div>
  );
}
