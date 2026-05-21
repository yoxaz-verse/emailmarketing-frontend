import { redirect } from 'next/navigation';
import Sidebar from '@/components/dashboard/Sidebar';
import TopBar from '@/components/dashboard/TopBar';
import AuthGuardClient from '@/components/dashboard/AuthGuardClient';
import { cookies } from 'next/headers';
import { serverFetch } from '@/lib/server/server-fetch';

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
  await serverFetch('/auth/me');

  return (
    <div className="flex bg-background min-h-screen">
      <Sidebar role={role} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar />
        <AuthGuardClient />

        <main className="flex-1 relative overflow-y-auto focus:outline-none">
          <div className="py-8 px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
