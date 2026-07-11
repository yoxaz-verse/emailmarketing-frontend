import { cookies } from 'next/headers';
import { serverFetch } from '@/lib/server/server-fetch';
import SocialSchedulingClient from './SocialSchedulingClient';

type Operator = { id: string; name: string; region?: string | null };

export default async function SocialSchedulingPage() {
  const cookieStore = await cookies();
  const role = cookieStore.get('user_role')?.value;
  const isAdmin = role === 'admin' || role === 'superadmin';
  let operators: Operator[] = [];
  let operatorLoadError: string | undefined;

  if (isAdmin) {
    try {
      operators = await serverFetch<Operator[]>('/admin/operators');
    } catch (err: unknown) {
      operatorLoadError = err instanceof Error ? err.message : 'Failed to load operators';
      operators = [];
    }
  }

  return (
    <SocialSchedulingClient
      role={role}
      operators={operators}
      operatorLoadError={operatorLoadError}
    />
  );
}
