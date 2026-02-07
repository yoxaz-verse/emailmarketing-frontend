import { serverFetch } from '@/lib/server/server-fetch';
import { redirect } from 'next/navigation';
import Sidebar from '@/components/dashboard/Sidebar';
import TopBar from '@/components/dashboard/TopBar';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await serverFetch('/auth/me');
  } catch (error) {
    console.log('UNAUTHORIZED', error);
    // 🔥 DB user deleted → kill session
    redirect('/api/auth/logout');
  }

  return (
    <div className="flex bg-gray-50 min-h-screen">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar />

        <main className="flex-1 relative overflow-y-auto focus:outline-none">
          <div className="py-8 px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
