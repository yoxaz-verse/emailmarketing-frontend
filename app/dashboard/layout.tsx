// app/dashboard/layout.tsx
import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
 
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token');

  console.log('DASHBOARD COOKIE:', token);

  if (!token) {
    redirect('/login');
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r">
        <div className="p-4 font-bold text-lg">
          Cold Email Admin
        </div>

        <nav className="px-4 space-y-2">
          <Link
            href="/dashboard"
            className="block rounded px-3 py-2 text-sm hover:bg-gray-100"
          >
            Overview
          </Link>

          <Link
            href="/dashboard/inboxes"
            className="block rounded px-3 py-2 text-sm hover:bg-gray-100"
          >
            Inboxes
          </Link>

          <Link
            href="/dashboard/sequences"
            className="block rounded px-3 py-2 text-sm hover:bg-gray-100"
          >
            Sequences
          </Link>

          <Link
            href="/dashboard/campaign"
            className="block rounded px-3 py-2 text-sm hover:bg-gray-100"
          >
            Campaign
          </Link>
        </nav>
      </aside>

      {/* Main */}
      <main className="flex-1">
        <header className="h-14 bg-white border-b flex items-center px-6">
          <h1 className="text-sm font-medium text-gray-700">
            Dashboard
          </h1>
        </header>

        <section className="p-6">
          {children}
        </section>
      </main>
    </div>
  );
}
