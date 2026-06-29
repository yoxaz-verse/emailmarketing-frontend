"use client";

import React from 'react';
import {
    LogOut
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import NotificationPanel from './NotificationPanel';
import { ThemeToggle } from '@/components/theme-toggle';

export default function TopBar({ initialEmail = '' }: { initialEmail?: string }) {
    const email = initialEmail.trim();

    const handleSignOut = () => {
        const shouldSignOut = window.confirm('Are you sure you want to sign out?');
        if (!shouldSignOut) return;
        window.location.href = '/api/auth/logout';
    };

    return (
        <header className="h-16 bg-card/95 border-b border-border flex items-center justify-between px-8 sticky top-0 z-30 backdrop-blur-xl">
            <div className="flex items-center gap-8">
                <h1 className="text-xl font-bold text-foreground border-r border-border pr-8 h-8 flex items-center">
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

            <div className="flex items-center gap-4">
                <NotificationPanel />
                <ThemeToggle />
                <p className="text-sm font-medium text-foreground max-w-[320px] truncate" title={email || 'Signed in'}>
                    {email || 'Signed in'}
                </p>
                <Button
                    variant="ghost"
                    className="text-red-600 dark:text-red-400 hover:text-red-600 dark:text-red-400 hover:bg-red-500/10"
                    onClick={handleSignOut}
                >
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                </Button>
            </div>
        </header>
    );
}
