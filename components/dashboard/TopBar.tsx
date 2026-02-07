"use client";

import React from 'react';
import { usePathname } from 'next/navigation';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Bell,
    Search,
    Settings,
    LogOut,
    User,
    HelpCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import NotificationPanel from './NotificationPanel';

export default function TopBar() {
    const pathname = usePathname();

    const getPageTitle = (path: string) => {
        const segments = path.split('/').filter(Boolean);
        if (segments.length <= 1) return 'Dashboard';
        const lastSegment = segments[segments.length - 1];
        return lastSegment.split(/[_-]/).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    };

    return (
        <header className="h-16 bg-white border-b flex items-center justify-between px-8 sticky top-0 z-30">
            <div className="flex items-center gap-8">
                <h1 className="text-xl font-bold text-gray-900 border-r pr-8 h-8 flex items-center">
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

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button className="flex items-center gap-3 p-1 rounded-full hover:bg-gray-50 transition-colors outline-none">
                            <div className="w-8 h-8 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-full flex items-center justify-center text-white text-xs font-bold border-2 border-white shadow-sm">
                                JD
                            </div>
                            <div className="text-left hidden lg:block">
                                <p className="text-sm font-semibold text-gray-900 leading-tight">John Doe</p>
                                <p className="text-[10px] text-gray-500 font-medium">Administrator</p>
                            </div>
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 mt-2">
                        <DropdownMenuLabel>My Account</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>
                            <User className="mr-2 h-4 w-4" /> Profile
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                            <Settings className="mr-2 h-4 w-4" /> Settings
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                            <HelpCircle className="mr-2 h-4 w-4" /> Support
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-red-600 focus:bg-red-50 focus:text-red-600" onClick={() => window.location.href = '/api/auth/logout'}>
                            <LogOut className="mr-2 h-4 w-4" /> Sign out
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </header>
    );
}
