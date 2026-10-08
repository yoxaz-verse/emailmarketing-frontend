import { redirect } from 'next/navigation';
import DashboardShell from '@/components/dashboard/DashboardShell';
import { cookies } from 'next/headers';
import { serverFetch } from '@/lib/server/server-fetch';
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
    redirect('/api/auth/logout?reason=session-ended');
  }

  // Validate token server-side before rendering dashboard shell.
  // serverFetch terminates the session when auth validation or the backend fails.
  const session = await serverFetch<AuthMeResponse>('/auth/me');

  const role = String(session?.role ?? cookieStore.get('user_role')?.value ?? '').trim();
  const accessFlags = normalizeModuleAccessFlags(session?.access_flags ?? {}, role);

  return <DashboardShell role={role} accessFlags={accessFlags} email={String(session?.email ?? '').trim()}>{children}</DashboardShell>;
}
