import { redirect } from 'next/navigation';
import DashboardShell from '@/components/dashboard/DashboardShell';
import { cookies } from 'next/headers';
import { serverFetch } from '@/lib/server/server-fetch';
import { isBackendUnavailableError } from '@/lib/server/backend-error';
import BackendUnavailableScreen from '@/components/dashboard/BackendUnavailableScreen';
import { normalizeModuleAccessFlags } from '@/lib/dashboard-access';

type AuthMeResponse = {
  email?: string | null;
  role?: string | null;
  access_flags?: Record<string, boolean> | null;
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  if (!token) {
    redirect('/login');
  }

  // Validate token server-side before rendering dashboard shell.
  // serverFetch redirects to /api/auth/logout on 401/403.
  let session: AuthMeResponse;
  try {
    session = await serverFetch<AuthMeResponse>('/auth/me');
  } catch (error) {
    if (!isBackendUnavailableError(error)) throw error;

    const isConfigurationError = error.kind === 'configuration';
    return (
      <BackendUnavailableScreen
        title={isConfigurationError ? 'Dashboard API is not configured' : undefined}
        message={isConfigurationError
          ? 'The dashboard backend URL is missing or invalid. Set NEXT_PUBLIC_API_BASE_URL and restart the dashboard.'
          : undefined}
      />
    );
  }

  const role = String(session?.role ?? cookieStore.get('user_role')?.value ?? '').trim();
  const accessFlags = normalizeModuleAccessFlags(session?.access_flags ?? {}, role);

  return <DashboardShell role={role} accessFlags={accessFlags} email={String(session?.email ?? '').trim()}>{children}</DashboardShell>;
}
