import { redirect } from 'next/navigation';
import DashboardShell from '@/components/dashboard/DashboardShell';
import { cookies } from 'next/headers';
import { normalizeModuleAccessFlags, parseModuleAccessCookie } from '@/lib/dashboard-access';

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

  const role = String(cookieStore.get('user_role')?.value ?? '').trim();
  const accessFlags = normalizeModuleAccessFlags(
    parseModuleAccessCookie(cookieStore.get('user_access_flags')?.value),
    role,
  );
  const email = String(cookieStore.get('user_email')?.value ?? '').trim();

  return <DashboardShell role={role} accessFlags={accessFlags} email={email}>{children}</DashboardShell>;
}
