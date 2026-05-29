"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { isAdminRole } from '@/lib/dashboard-access';
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
    ChevronRight,
    Bot,
    CalendarClock,
    Newspaper,
    Cpu,
    Link2
} from 'lucide-react';

const mainItems = [
    { label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
];

const marketingItems = [
    { label: 'Campaigns', href: '/dashboard/campaign', icon: Megaphone },
    { label: 'Replies', href: '/dashboard/campaign/replies', icon: Mail },
    { label: 'Campaign Lead', href: '/dashboard/campaign_leads', icon: UserPlus },
    { label: 'Leads', href: '/dashboard/leads', icon: Users },
    { label: 'Bulk Upload', href: '/dashboard/leads/upload', icon: UserPlus },
    { label: 'Sequences', href: '/dashboard/sequences', icon: Repeat },
];

const newsletterItems = [
    { label: 'Newsletter Subscribers', href: '/dashboard/newsletter_subscribers', icon: Users },
    { label: 'Newsletter Issues', href: '/dashboard/newsletter_issues', icon: Megaphone },
    { label: 'Newsletter Preferences', href: '/dashboard/newsletter_preferences', icon: Repeat },
    { label: 'Newsletter Jobs', href: '/dashboard/newsletter_send_jobs', icon: Mail },
    { label: 'Newsletter Logs', href: '/dashboard/newsletter_send_logs', icon: Mail },
];

const socialMediaItems = [
    { label: 'Social Scheduling', href: '/dashboard/social-scheduling', icon: CalendarClock },
    { label: 'Social Connectors', href: '/dashboard/social-connectors', icon: Link2 },
    { label: 'Blog Scheduler', href: '/dashboard/blog-distribution', icon: Newspaper },
];

const emailItems = [
    { label: 'Inboxes', href: '/dashboard/inboxes', icon: Mail },
    { label: 'Domains', href: '/dashboard/sending_domains', icon: Globe },
    { label: 'SMTP Accounts', href: '/dashboard/smtp_accounts', icon: Server },
];

const voiceItems = [
    { label: 'Voice Agents', href: '/dashboard/voice-agents', icon: Mic, comingSoon: true },
];

const openFlowItems = [
    { label: 'Task Center', href: '/dashboard/agent-integrations', icon: Bot },
    { label: 'Running Agents', href: '/dashboard/agents', icon: Cpu },
    { label: 'Marketplace Publishing', href: '/dashboard/marketplace-publishing', icon: Bot },
];

const inquiryItems = [
    { label: 'Inquiry Fetching', href: '/dashboard/inquiry-fetching', icon: Bot },
    { label: 'Inquiry Quoting', href: '/dashboard/inquiry-quoting', icon: Bot },
];

const adminItems = [
    { label: 'Users', href: '/dashboard/users', icon: UserCog },
    { label: 'Social App Settings', href: '/dashboard/admin/social-apps', icon: UserCog },
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

export default function Sidebar({ role }: { role?: string }) {
    const pathname = usePathname();
    const isAdmin = isAdminRole(role);

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

                {isAdmin && (
                    <div>
                        <h3 className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                            Newsletter
                        </h3>
                        <ul className="space-y-1">
                            {newsletterItems.map((item) => renderNavItem(item, pathname === item.href))}
                        </ul>
                    </div>
                )}

                {isAdmin && (
                    <div>
                        <h3 className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                            Social Media
                        </h3>
                        <ul className="space-y-1">
                            {socialMediaItems.map((item) => renderNavItem(item, pathname === item.href))}
                        </ul>
                    </div>
                )}

                {isAdmin && (
                    <div>
                        <h3 className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                            Email Automation
                        </h3>
                        <ul className="space-y-1">
                            {emailItems.map((item) => renderNavItem(item, pathname === item.href))}
                        </ul>
                    </div>
                )}

                {isAdmin && (
                    <div>
                        <h3 className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                            Voice AI (CS)
                        </h3>
                        <ul className="space-y-1">
                            {voiceItems.map((item) => renderNavItem(item, pathname.startsWith(item.href)))}
                        </ul>
                    </div>
                )}

                {isAdmin && (
                    <div>
                        <h3 className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                            OpenFlow AI
                        </h3>
                        <ul className="space-y-1">
                            {openFlowItems.map((item) => renderNavItem(item, pathname.startsWith(item.href)))}
                        </ul>
                    </div>
                )}

                {isAdmin && (
                    <div>
                        <h3 className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                            Inquiry
                        </h3>
                        <ul className="space-y-1">
                            {inquiryItems.map((item) => renderNavItem(item, pathname.startsWith(item.href)))}
                        </ul>
                    </div>
                )}

                {isAdmin && (
                    <div>
                        <h3 className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                            Admin
                        </h3>
                        <ul className="space-y-1">
                            {adminItems.map((item) => renderNavItem(item, pathname === item.href))}
                        </ul>
                    </div>
                )}
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
