"use client";

import React from 'react';
import {
    LogOut,
    Menu
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import NotificationPanel from './NotificationPanel';
import { ThemeToggle } from '@/components/theme-toggle';

export default function TopBar({ initialEmail = '', onMenuClick }: { initialEmail?: string; onMenuClick?: () => void }) {
    const email = initialEmail.trim();

    const handleSignOut = () => {
        const shouldSignOut = window.confirm('Are you sure you want to sign out?');
        if (!shouldSignOut) return;
        window.location.href = '/api/auth/logout';
    };

    return (
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-card/95 px-3 backdrop-blur-xl sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3 sm:gap-6">
                <Button type="button" variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation" onClick={onMenuClick}>
                    <Menu className="h-5 w-5" />
                </Button>
                <h1 className="flex h-8 items-center text-lg font-bold text-foreground sm:border-r sm:border-border sm:pr-6 sm:text-xl">
                    <span className="text-primary">OBAOL</span>
                    {/* {getPageTitle(pathname)} */}
                </h1>

                {/* <div className="relative group hidden md:block">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input
                        placeholder="Search dashboard..."
                        className="pl-9 w-[300px] h-9 border-none bg-muted focus:bg-card focus:ring-1 focus:ring-primary/30 rounded-lg text-sm transition-all"
                    />
                </div> */}
            </div>

            <div className="flex min-w-0 items-center gap-1 sm:gap-3">
                <NotificationPanel />
                <ThemeToggle />
                <p className="hidden max-w-[220px] truncate text-sm font-medium text-foreground md:block" title={email || 'Signed in'}>
                    {email || 'Signed in'}
                </p>
                <Button
                    variant="ghost"
                    className="text-red-600 hover:bg-red-500/10 hover:text-red-600 dark:text-red-400"
                    onClick={handleSignOut}
                >
                    <LogOut className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Sign out</span>
                </Button>
            </div>
        </header>
    );
}
