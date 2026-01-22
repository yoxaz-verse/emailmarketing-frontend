import { cookies } from 'next/headers';
import UploadLeadsForm from './UploadLeadsForm';
import { serverFetch } from '@/lib/server/server-fetch';

export default async function UploadLeadsPage() {
    const cookieStore = await cookies(); // ✅ FIX
    const role = cookieStore.get('user_role')?.value;
 
  
  let operators: any[] = [];

  if (role === 'admin') {
    operators = await serverFetch('/admin/operators');
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Upload Leads</h2>

      <UploadLeadsForm
        role={role}
        operators={operators}
      />
    </div>
  );
}
