"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
    LayoutDashboard,
    Mail,
    Repeat,
    Users,
    Globe,
    Server,
    UserPlus,
    Megaphone,
    UserCog,
    Mic,
    ChevronRight
} from 'lucide-react';

const mainItems = [
    { label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
];

const marketingItems = [
    { label: 'Campaigns', href: '/dashboard/campaign', icon: Megaphone },
    { label: 'Campaign Lead', href: '/dashboard/campaign_leads', icon: UserPlus },
    { label: 'Leads', href: '/dashboard/leads', icon: Users },
    { label: 'Sequences', href: '/dashboard/sequences', icon: Repeat },
];

const emailItems = [
    { label: 'Inboxes', href: '/dashboard/inboxes', icon: Mail },
    { label: 'Domains', href: '/dashboard/sending_domains', icon: Globe },
    { label: 'SMTP Accounts', href: '/dashboard/smtp_accounts', icon: Server },
];

const voiceItems = [
    { label: 'Voice Agents', href: '/dashboard/voice-agents', icon: Mic },
];

const adminItems = [
    { label: 'Users', href: '/dashboard/users', icon: UserCog },
];

export default function Sidebar() {
    const pathname = usePathname();

    const renderNavItem = (item: any, isActive: boolean) => (
        <li key={item.href}>
            <Link
                href={item.href}
                className={cn(
                    "flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 group",
                    isActive
                        ? "bg-blue-50 text-blue-700"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                )}
            >
                <div className="flex items-center gap-3">
                    <item.icon className={cn(
                        "h-4 w-4 transition-colors",
                        isActive ? "text-blue-600" : "text-gray-400 group-hover:text-gray-600"
                    )} />
                    {item.label}
                </div>
                {isActive && <ChevronRight className="h-4 w-4" />}
            </Link>
        </li>
    );

    return (
        <aside className="w-64 bg-white border-r flex flex-col h-screen sticky top-0">
            <div className="p-6">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">
                        O
                    </div>
                    <span className="font-bold text-xl tracking-tight text-gray-900">Obaol</span>
                </div>
            </div>

            <nav className="flex-1 px-4 py-4 space-y-8 overflow-y-auto">
                <ul className="space-y-1">
                    {mainItems.map((item) => renderNavItem(item, pathname === item.href))}
                </ul>

                <div>
                    <h3 className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
                        Marketing
                    </h3>
                    <ul className="space-y-1">
                        {marketingItems.map((item) => renderNavItem(item, pathname === item.href))}
                    </ul>
                </div>

                <div>
                    <h3 className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
                        Email AI
                    </h3>
                    <ul className="space-y-1">
                        {emailItems.map((item) => renderNavItem(item, pathname === item.href))}
                    </ul>
                </div>

                <div>
                    <h3 className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
                        Voice AI
                    </h3>
                    <ul className="space-y-1">
                        {voiceItems.map((item) => renderNavItem(item, pathname.startsWith(item.href)))}
                    </ul>
                </div>

                <div>
                    <h3 className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
                        Admin
                    </h3>
                    <ul className="space-y-1">
                        {adminItems.map((item) => renderNavItem(item, pathname === item.href))}
                    </ul>
                </div>
            </nav>

            {/* <div className="p-4 border-t bg-gray-50/50">
                <div className="bg-blue-600 rounded-xl p-4 text-white">
                    <p className="text-xs font-medium text-blue-100">Pro Plan</p>
                    <p className="text-sm font-bold mt-1">Unlimited Leads</p>
                    <button className="w-full mt-3 bg-white text-blue-700 text-xs font-bold py-2 rounded-lg hover:bg-blue-50 transition-colors">
                        Upgrade
                    </button>
                </div>
            </div> */}
        </aside>
    );
}
