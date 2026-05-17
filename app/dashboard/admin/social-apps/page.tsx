import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { serverFetch } from '@/lib/server/server-fetch';
import SocialAppsSettingsClient from './social-apps-settings-client';

type Operator = { id: string; name: string; region?: string | null };

type PageProps = {
  searchParams?: Promise<{
    operator_id?: string;
    platform?: string;
  }>;
};

export default async function SocialAppsSettingsPage({ searchParams }: PageProps) {
  const cookieStore = await cookies();
  const role = cookieStore.get('user_role')?.value;
  const isAdmin = role === 'admin' || role === 'superadmin';

  if (!isAdmin) {
    redirect('/dashboard/social-connectors');
  }

  const query = (await searchParams) ?? {};

  let operators: Operator[] = [];
  let loadError: string | undefined;

  try {
    operators = await serverFetch<Operator[]>('/admin/operators');
  } catch (err: unknown) {
    loadError = err instanceof Error ? err.message : 'Failed to load operators';
  }

  return (
    <SocialAppsSettingsClient
      operators={operators}
      initialOperatorId={query.operator_id ?? ''}
      initialPlatform={query.platform ?? 'linkedin'}
      loadError={loadError}
    />
  );
}
