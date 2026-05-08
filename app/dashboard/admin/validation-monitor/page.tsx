import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import ValidationMonitorClient from './validation-monitor-client';
import { getValidationMonitorAction } from './actions';

export default async function ValidationMonitorPage() {
  const cookieStore = await cookies();
  const role = cookieStore.get('user_role')?.value;
  const isAdmin = role === 'admin' || role === 'superadmin';

  if (!isAdmin) {
    redirect('/dashboard');
  }

  let initialData = null;
  let loadError: string | undefined;
  try {
    initialData = await getValidationMonitorAction();
  } catch (err: any) {
    loadError = err?.message ?? 'Failed to load validation monitor';
  }

  return <ValidationMonitorClient initialData={initialData} loadError={loadError} />;
}
