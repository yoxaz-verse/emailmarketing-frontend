"use client";
import Link from 'next/link';
import { useState } from 'react';
import { Bell } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { type Feed, markRead, useCommunications } from '@/lib/communications';
export default function NotificationPanel() {
  const {data,error,loading,refresh}=useCommunications<Feed>('/communications?limit=6');
  const [actionError,setActionError]=useState('');
  async function readAll(){if(!data)return;try{await markRead(null,data.as_of);setActionError('');}catch(e){setActionError((e as Error).message);}}
  return <DropdownMenu onOpenChange={open=>{if(open)void refresh();}}>
    <DropdownMenuTrigger asChild><button className="relative rounded-full p-2 text-muted-foreground hover:bg-accent" aria-label={`Notifications${data ? `, ${data.unread_count} unread` : ''}`}><Bell className="h-5 w-5"/>{Boolean(data?.unread_count)&&<span className="absolute -right-1 -top-1 rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">{data!.unread_count>99?'99+':data!.unread_count}</span>}</button></DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-[min(360px,calc(100vw-24px))] p-0">
      <DropdownMenuLabel className="border-b border-border p-4">Communications</DropdownMenuLabel>
      {(error||actionError)&&<div role="alert" className="p-3 text-xs text-amber-600">{actionError||error} {data?'Showing last loaded updates.':''} <button className="underline" onClick={()=>void refresh()}>Retry</button></div>}
      {!data&&loading&&<p className="p-5 text-sm">Loading updates…</p>}
      {data?.items.length===0&&<p className="p-8 text-center text-sm text-muted-foreground">No communications yet</p>}
      <div className="max-h-80 overflow-y-auto divide-y divide-border">{data?.items.map(item=><Link key={item.id} href={`/dashboard/communications?item=${item.id}`} className="block p-4 hover:bg-muted"><div className="flex gap-2"><p className="line-clamp-2 text-sm font-medium">{item.title}</p>{item.unread&&<span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Unread"/>}</div><p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{item.preview}</p><p className="mt-2 text-xs text-muted-foreground">{item.source} · {new Date(item.occurred_at).toLocaleString()}</p></Link>)}</div>
      <div className="flex justify-between border-t border-border p-3 text-xs"><button disabled={!data} onClick={()=>void readAll()}>Mark all as read</button><Link href="/dashboard/communications" className="text-primary">View all</Link></div>
    </DropdownMenuContent>
  </DropdownMenu>;
}
