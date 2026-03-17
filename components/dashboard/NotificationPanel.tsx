"use client";

import React, { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function getRelativeTime(dateString: string) {
    try {
        const date = new Date(dateString);
        const now = new Date();
        const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

        if (diffInSeconds < 10) return 'Just now';
        if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
        return `${Math.floor(diffInSeconds / 86400)}d ago`;
    } catch (e) {
        return 'recently';
    }
}

export default function NotificationPanel() {
    const [notifications, setNotifications] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchNotifications = async () => {
        // Temporarily disabled to prevent "Failed to fetch" errors
        return;
        setLoading(true);
        try {
            const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
            const res = await fetch(`${API_URL}/stats/notifications`);
            if (res.ok) {
                const data = await res.json();
                setNotifications(data);
            }
        } catch (err) {
            console.error('Failed to fetch notifications', err);
        } finally {
            setLoading(false);
        }
    };

    // Initial fetch to show the red dot if there are notifications
    useEffect(() => {
        fetchNotifications();
    }, []);

    return (
        <DropdownMenu onOpenChange={(open) => open && fetchNotifications()}>
            <DropdownMenuTrigger asChild>
                <button className="relative p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted transition-colors outline-none cursor-pointer group">
                    <Bell className="h-5 w-5 transform group-hover:rotate-12 transition-transform" />
                    {notifications.length > 0 && (
                        <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-background animate-pulse"></span>
                    )}
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 mt-2 p-0 overflow-hidden shadow-2xl border-border bg-popover text-popover-foreground animate-in fade-in zoom-in-95 duration-200">
                <DropdownMenuLabel className="p-4 bg-muted/40 border-b border-border">
                    <div className="flex items-center justify-between">
                        <span className="font-bold text-foreground tracking-tight">Notifications</span>
                        <span className="text-[10px] font-bold text-blue-300 bg-blue-500/10 px-2.5 py-1 rounded-full uppercase tracking-widest ring-1 ring-blue-500/20">
                            Activity
                        </span>
                    </div>
                </DropdownMenuLabel>

                <div className="max-h-[380px] overflow-y-auto">
                    {loading && notifications.length === 0 ? (
                        <div className="p-12 text-center">
                            <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-3" />
                            <p className="text-[11px] font-medium text-muted-foreground tracking-wide uppercase">Updating feed...</p>
                        </div>
                    ) : notifications.length === 0 ? (
                        <div className="p-12 text-center">
                            <div className="bg-muted w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                                <Bell className="h-6 w-6 text-muted-foreground/60" />
                            </div>
                            <p className="text-sm font-semibold text-foreground">Quiet for now</p>
                            <p className="text-xs text-muted-foreground mt-1">No notifications yet</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-border">
                            {notifications.map((n) => (
                                <div key={n.id} className="p-4 hover:bg-muted/60 transition-all cursor-default group/item">
                                    <div className="flex gap-3">
                                        <div className="mt-1 flex-shrink-0">
                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 group-hover/item:scale-125 transition-transform" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm text-foreground leading-relaxed font-medium">
                                                {n.message}
                                            </p>
                                            <div className="flex items-center gap-2 mt-2">
                                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">
                                                    {n.type?.replace(/_/g, ' ')}
                                                </span>
                                                <span className="text-[10px] text-muted-foreground/60">•</span>
                                                <p className="text-[10px] text-muted-foreground font-medium italic">
                                                    {getRelativeTime(n.created_at)}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <DropdownMenuSeparator className="m-0" />
                <button
                    onClick={() => setNotifications([])}
                    className="w-full p-3.5 text-[10px] font-bold text-muted-foreground hover:text-blue-300 hover:bg-blue-500/10 transition-all uppercase tracking-[0.2em] border-t border-border"
                >
                    Mark all as read
                </button>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
