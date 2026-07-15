"use client";

import { useEffect, useState } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import type { ModuleAccessFlags } from '@/lib/dashboard-access';

export default function DashboardShell({ role, accessFlags, email, children }: { role?: string; accessFlags?: ModuleAccessFlags; email: string; children: React.ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const close = (event: KeyboardEvent) => event.key === 'Escape' && setMobileNavOpen(false);
    document.addEventListener('keydown', close);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', close);
      document.body.style.overflow = '';
    };
  }, [mobileNavOpen]);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role={role} accessFlags={accessFlags} mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      {mobileNavOpen && (
        <button type="button" aria-label="Close navigation" className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" onClick={() => setMobileNavOpen(false)} />
      )}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar initialEmail={email} onMenuClick={() => setMobileNavOpen(true)} />
        <main id="main-content" tabIndex={-1} className="relative flex-1 overflow-y-auto focus:outline-none">
          <div className="px-4 py-5 sm:px-6 sm:py-6 xl:px-8 xl:py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
