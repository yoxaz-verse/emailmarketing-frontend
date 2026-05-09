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
    { label: 'Bulk Upload', href: '/dashboard/leads/upload', icon: UserPlus },
    { label: 'Sequences', href: '/dashboard/sequences', icon: Repeat },
];

const emailItems = [
    { label: 'Inboxes', href: '/dashboard/inboxes', icon: Mail },
    { label: 'Domains', href: '/dashboard/sending_domains', icon: Globe },
    { label: 'SMTP Accounts', href: '/dashboard/smtp_accounts', icon: Server },
];

const voiceItems = [
    { label: 'Voice Agents', href: '/dashboard/voice-agents', icon: Mic, comingSoon: true },
];

const adminItems = [
    { label: 'Users', href: '/dashboard/users', icon: UserCog },
    { label: 'Sending Limits', href: '/dashboard/admin/sending-limits', icon: UserCog },
    { label: 'Campaign Rules', href: '/dashboard/admin/campaign-rules', icon: UserCog },
    { label: 'Validation Monitor', href: '/dashboard/admin/validation-monitor', icon: UserCog },
];

type NavItem = {
    label: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    comingSoon?: boolean;
};

export default function Sidebar() {
    const pathname = usePathname();

const renderNavItem = (item: NavItem, isActive: boolean) => (
        <li key={item.href}>
            <Link
                href={item.href}
                className={cn(
                    "flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 group",
                    isActive
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
            >
                <div className="flex items-center gap-3">
                    <item.icon className={cn(
                        "h-4 w-4 transition-colors",
                        isActive ? "text-accent-foreground" : "text-muted-foreground group-hover:text-foreground"
                    )} />
                    {item.label}
                    {item.comingSoon && (
                        <span className="rounded-full border border-yellow-500/40 bg-yellow-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-yellow-300">
                            CS
                        </span>
                    )}
                </div>
                {isActive && <ChevronRight className="h-4 w-4" />}
            </Link>
        </li>
    );

    return (
        <aside className="w-64 bg-card border-r border-border flex flex-col h-screen sticky top-0">
            <div className="p-6">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">
                        O
                    </div>
                    <span className="font-bold text-xl tracking-tight text-foreground">Obaol</span>
                </div>
            </div>

            <nav className="flex-1 px-4 py-4 space-y-8 overflow-y-auto">
                <ul className="space-y-1">
                    {mainItems.map((item) => renderNavItem(item, pathname === item.href))}
                </ul>

                <div>
                    <h3 className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                        Marketing
                    </h3>
                    <ul className="space-y-1">
                        {marketingItems.map((item) => renderNavItem(item, pathname === item.href))}
                    </ul>
                </div>

                <div>
                    <h3 className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                        Email Automation
                    </h3>
                    <ul className="space-y-1">
                        {emailItems.map((item) => renderNavItem(item, pathname === item.href))}
                    </ul>
                </div>

                <div>
                    <h3 className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                        Voice AI (CS)
                    </h3>
                    <ul className="space-y-1">
                        {voiceItems.map((item) => renderNavItem(item, pathname.startsWith(item.href)))}
                    </ul>
                </div>

                <div>
                    <h3 className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
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
