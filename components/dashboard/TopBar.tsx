"use client";

import React, { useEffect, useState } from 'react';
import {
    LogOut
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import NotificationPanel from './NotificationPanel';
import { clientFetch } from '@/lib/client-fetch';

type AuthMeResponse = {
    id?: string;
    role?: string;
    operator_id?: string | null;
    email?: string;
};

export default function TopBar() {
    const [email, setEmail] = useState<string>('');

    const getDisplayEmail = (value: unknown): string => {
        if (typeof value !== 'string') return '';
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : '';
    };

    useEffect(() => {
        let active = true;
        clientFetch<AuthMeResponse>('/auth/me')
            .then((data) => {
                if (!active) return;
                setEmail(getDisplayEmail(data?.email));
            })
            .catch(() => {
                if (!active) return;
                setEmail('');
            });

        return () => {
            active = false;
        };
    }, []);

    const handleSignOut = () => {
        const shouldSignOut = window.confirm('Are you sure you want to sign out?');
        if (!shouldSignOut) return;
        window.location.href = '/api/auth/logout';
    };

    return (
        <header className="h-16 bg-card border-b border-border flex items-center justify-between px-8 sticky top-0 z-30">
            <div className="flex items-center gap-8">
                <h1 className="text-xl font-bold text-foreground border-r border-border pr-8 h-8 flex items-center">
                    OBT
                    {/* {getPageTitle(pathname)} */}
                </h1>

                {/* <div className="relative group hidden md:block">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                    <Input
                        placeholder="Search dashboard..."
                        className="pl-9 w-[300px] h-9 border-none bg-gray-50 focus:bg-white focus:ring-1 focus:ring-blue-100 rounded-lg text-sm transition-all"
                    />
                </div> */}
            </div>

            <div className="flex items-center gap-4">
                <NotificationPanel />
                <p className="text-sm font-medium text-foreground max-w-[320px] truncate" title={email || 'Signed in'}>
                    {email || 'Signed in'}
                </p>
                <Button
                    variant="ghost"
                    className="text-red-500 hover:text-red-500 hover:bg-red-500/10"
                    onClick={handleSignOut}
                >
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                </Button>
            </div>
        </header>
    );
}
