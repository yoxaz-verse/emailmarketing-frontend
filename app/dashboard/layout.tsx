import { redirect } from 'next/navigation';
import DashboardShell from '@/components/dashboard/DashboardShell';
import { cookies } from 'next/headers';
import { serverFetch } from '@/lib/server/server-fetch';

type AuthMeResponse = {
  email?: string | null;
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  const role = cookieStore.get('user_role')?.value;
  if (!token) {
    redirect('/login');
  }

  // Validate token server-side before rendering dashboard shell.
  // serverFetch redirects to /api/auth/logout on 401/403.
  const session = await serverFetch<AuthMeResponse>('/auth/me');

  return <DashboardShell role={role} email={String(session?.email ?? '').trim()}>{children}</DashboardShell>;
}
