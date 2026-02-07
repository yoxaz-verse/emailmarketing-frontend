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
                <button className="relative p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors outline-none cursor-pointer group">
                    <Bell className="h-5 w-5 transform group-hover:rotate-12 transition-transform" />
                    {notifications.length > 0 && (
                        <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
                    )}
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 mt-2 p-0 overflow-hidden shadow-2xl border-gray-200 animate-in fade-in zoom-in-95 duration-200">
                <DropdownMenuLabel className="p-4 bg-gray-50/50 border-b">
                    <div className="flex items-center justify-between">
                        <span className="font-bold text-gray-900 tracking-tight">Notifications</span>
                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full uppercase tracking-widest ring-1 ring-blue-100/50">
                            Activity
                        </span>
                    </div>
                </DropdownMenuLabel>

                <div className="max-h-[380px] overflow-y-auto">
                    {loading && notifications.length === 0 ? (
                        <div className="p-12 text-center">
                            <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-3" />
                            <p className="text-[11px] font-medium text-gray-400 tracking-wide uppercase">Updating feed...</p>
                        </div>
                    ) : notifications.length === 0 ? (
                        <div className="p-12 text-center">
                            <div className="bg-gray-50 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                                <Bell className="h-6 w-6 text-gray-300" />
                            </div>
                            <p className="text-sm font-semibold text-gray-900">Quiet for now</p>
                            <p className="text-xs text-gray-400 mt-1">No notifications yet</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100/80">
                            {notifications.map((n) => (
                                <div key={n.id} className="p-4 hover:bg-gray-50/80 transition-all cursor-default group/item">
                                    <div className="flex gap-3">
                                        <div className="mt-1 flex-shrink-0">
                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 group-hover/item:scale-125 transition-transform" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm text-gray-700 leading-relaxed font-medium">
                                                {n.message}
                                            </p>
                                            <div className="flex items-center gap-2 mt-2">
                                                <span className="text-[10px] font-bold text-gray-400/80 uppercase tracking-tighter">
                                                    {n.type?.replace(/_/g, ' ')}
                                                </span>
                                                <span className="text-[10px] text-gray-300">•</span>
                                                <p className="text-[10px] text-gray-400 font-medium italic">
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
                    className="w-full p-3.5 text-[10px] font-bold text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-all uppercase tracking-[0.2em] border-t border-gray-100"
                >
                    Mark all as read
                </button>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
