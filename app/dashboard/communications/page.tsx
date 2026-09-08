"use client";
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Bell, Mail, RefreshCw, Send, ArrowLeft, ExternalLink } from 'lucide-react';
import { clientFetch } from '@/lib/client-fetch';
import { type Detail, type Feed, markRead, notifyCommunications, useCommunications } from '@/lib/communications';

const control='rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-50';
export default function CommunicationsPage() {
  const [kind,setKind]=useState(''),[source,setSource]=useState(''),[search,setSearch]=useState(''),[query,setQuery]=useState(''),[unread,setUnread]=useState(false),[page,setPage]=useState(1),[selected,setSelected]=useState<string|null>(null),[actionError,setActionError]=useState('');
  useEffect(()=>{const id=new URLSearchParams(window.location.search).get('item');if(id)setSelected(id);},[]);
  useEffect(()=>{const timer=setTimeout(()=>{setQuery(search);setPage(1);},300);return()=>clearTimeout(timer);},[search]);
  const params=new URLSearchParams({kind,source,search:query,unread:String(unread),page:String(page)});
  const feed=useCommunications<Feed>(`/communications?${params}`);
  async function readAll(){if(!feed.data)return;try{await markRead(null,feed.data.as_of);setActionError('');}catch(e){setActionError((e as Error).message);}}
  return <main className="space-y-5 p-4 sm:p-6">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-semibold">Communications</h1><p className="mt-1 text-sm text-muted-foreground">Your conversations and updates, together.{feed.data ? ` ${feed.data.unread_count} unread.`:''}</p></div><div className="flex gap-2"><button className={control} onClick={()=>void feed.refresh()} aria-label="Refresh communications"><RefreshCw className={`h-4 w-4 ${feed.loading?'animate-spin':''}`}/></button><button className={control} disabled={!feed.data} onClick={()=>void readAll()}>Mark all as read</button></div></header>
    <div className="flex gap-2" role="tablist" aria-label="Communication type">{[['','All'],['message','Messages'],['notification','Notifications']].map(([value,label])=><button key={value} role="tab" aria-selected={kind===value} className={`${control} ${kind===value?'bg-primary text-primary-foreground':''}`} onClick={()=>{setKind(value);setPage(1);}}>{label}</button>)}</div>
    <div className="flex flex-wrap gap-3"><input className={`${control} min-w-0 flex-1`} aria-label="Search communications" placeholder="Search messages and updates…" value={search} maxLength={200} onChange={e=>setSearch(e.target.value)}/><select className={control} aria-label="Source" value={source} onChange={e=>{setSource(e.target.value);setPage(1);}}>{[['','All sources'],['email','Email'],['campaign','Campaigns'],['social','Social'],['voice','Voice'],['agent','Agents'],['system','System']].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={unread} onChange={e=>{setUnread(e.target.checked);setPage(1);}}/>Unread only</label></div>
    {(feed.error||actionError)&&<div role="alert" className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">{actionError||feed.error} {feed.data?'Showing the last loaded results. ':''}<button className="underline" onClick={()=>void feed.refresh()}>Retry</button></div>}
    <div className="grid min-h-[560px] overflow-hidden rounded-xl border border-border bg-card lg:grid-cols-[minmax(280px,0.85fr)_minmax(0,1.4fr)]">
      <section aria-label="Communications list" className={`${selected?'hidden lg:block':''} min-w-0 border-border lg:border-r`}>
        {!feed.data&&feed.loading&&<p className="p-8 text-muted-foreground">Loading communications…</p>}
        {feed.data?.items.length===0&&<div className="p-10 text-center"><Bell className="mx-auto mb-3 h-8 w-8 text-muted-foreground"/><p>No communications found</p><p className="mt-1 text-sm text-muted-foreground">New messages and activity will appear here.</p></div>}
        <div className="divide-y divide-border">{feed.data?.items.map(item=><button key={item.id} onClick={()=>setSelected(item.id)} className={`flex w-full gap-3 p-4 text-left hover:bg-muted/60 ${selected===item.id?'bg-muted':''}`}>
          {item.kind==='message'?<Mail className="mt-1 h-5 w-5 shrink-0 text-primary"/>:<Bell className="mt-1 h-5 w-5 shrink-0 text-muted-foreground"/>}<div className="min-w-0 flex-1"><div className="flex items-start gap-2"><span className={`line-clamp-2 text-sm ${item.unread?'font-semibold':'font-medium'}`}>{item.title}</span>{item.unread&&<span aria-label="Unread" className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary"/>}</div><p className="mt-1 line-clamp-2 break-words text-sm text-muted-foreground">{item.preview}</p><p className="mt-2 text-xs text-muted-foreground">{item.source} · {new Date(item.occurred_at).toLocaleString()}</p></div></button>)}</div>
        {feed.data&&<div className="flex items-center justify-between border-t border-border p-3 text-sm"><button className={control} disabled={page===1} onClick={()=>setPage(page-1)}>Previous</button><span>{page} / {Math.max(1,Math.ceil(feed.data.total/30))}</span><button className={control} disabled={page*30>=feed.data.total} onClick={()=>setPage(page+1)}>Next</button></div>}
      </section>
      {selected?<Conversation key={selected} id={selected} back={()=>setSelected(null)}/>:<div className="hidden items-center justify-center p-10 text-muted-foreground lg:flex">Select a conversation or notification</div>}
    </div>
  </main>;
}
function Conversation({id,back}:{id:string;back:()=>void}) {
  const {data,error,loading,refresh}=useCommunications<Detail>(`/communications/${id}`);
  const [body,setBody]=useState(''),[sending,setSending]=useState(false),[notice,setNotice]=useState('');
  const attempt=useRef<{key:string;body:string}|null>(null),marked=useRef('');
  useEffect(()=>{if(data?.item.unread&&marked.current!==data.item.activity_at){marked.current=data.item.activity_at;void markRead([id],data.as_of).catch(e=>{marked.current='';setNotice(e.message);});}},[data,id]);
  async function send() {
    if(!body.trim()||sending)return;
    setSending(true);setNotice('');
    if(!attempt.current)attempt.current={key:crypto.randomUUID(),body:body.trim()};
    try {
      const sent=await clientFetch<{status:string}>(`/communications/${id}/reply`,{method:'POST',body:JSON.stringify({body:attempt.current.body,idempotency_key:attempt.current.key}),timeoutMs:60000});
      setNotice(sent.status==='sent'?'Reply sent.':sent.status==='failed'?'The mail server rejected the reply. Review the conversation before trying again.':'Delivery is pending or uncertain. Do not resend until the mailbox has been checked.');
      if(sent.status==='sent'||sent.status==='failed'){setBody('');attempt.current=null;}
      notifyCommunications();void refresh();
    } catch(e){setNotice(`${(e as Error).message} Retry checks the same send attempt and will not send a duplicate.`);}finally{setSending(false);}
  }
  return <section aria-label="Communication details" className="min-w-0 p-4 sm:p-6"><button className="mb-4 flex items-center gap-2 text-sm lg:hidden" onClick={back}><ArrowLeft className="h-4 w-4"/>Back to inbox</button>
    {error&&<p role="alert" className="mb-4 text-sm text-amber-600">{error} {data?'Showing previously loaded content.':''} <button className="underline" onClick={()=>void refresh()}>Retry</button></p>}
    {!data&&loading&&<p>Loading conversation…</p>}
    {data&&<><h2 className="break-words text-lg font-semibold">{data.item.title}</h2><p className="mt-1 text-xs text-muted-foreground">{data.item.source} · {new Date(data.item.occurred_at).toLocaleString()}</p>
      {data.conversation?.campaign_id&&<Link className="mt-3 inline-block text-sm text-primary underline" href={`/dashboard/campaign/${encodeURIComponent(data.conversation.campaign_id)}`}>View campaign</Link>}
      {data.item.href&&<Link href={data.item.href} className="my-4 inline-flex items-center gap-1 text-sm text-primary underline">Open source <ExternalLink className="h-3 w-3"/></Link>}
      {data.conversation?<div className="my-5 space-y-4">{data.messages.map(m=><article key={m.id} className={`rounded-lg border border-border p-4 ${m.direction==='outbound'?'bg-primary/5':'bg-background'}`}><div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground"><span className="break-all">From: {m.sender||'Unknown'}<br/>To: {m.recipient||'Unknown'}</span><span>{new Date(m.occurred_at).toLocaleString()} · {m.status}</span></div><p className="mt-3 whitespace-pre-wrap break-words text-sm">{m.body || 'Message content was not retained.'}</p>{m.status==='uncertain'&&<p className="mt-2 text-xs text-amber-600">Delivery could not be confirmed. Check the mailbox before resending.</p>}</article>)}</div>:<p className="my-5 whitespace-pre-wrap break-words text-sm">{data.item.preview}</p>}
      {data.conversation&&<form onSubmit={e=>{e.preventDefault();void send();}} className="space-y-3 border-t border-border pt-4"><label className="block text-sm font-medium" htmlFor="reply">Reply to {data.conversation.recipient || 'unknown sender'}</label><textarea id="reply" className={`${control} min-h-32 w-full`} placeholder="Write a reply…" value={body} maxLength={50000} onChange={e=>setBody(e.target.value)} disabled={!data.can_reply||sending||Boolean(attempt.current)}/>{data.reply_disabled_reason&&<p className="text-sm text-muted-foreground">{data.reply_disabled_reason}</p>}<button type="submit" className={`${control} inline-flex items-center gap-2 bg-primary text-primary-foreground`} disabled={!data.can_reply||sending||!body.trim()}><Send className="h-4 w-4"/>{sending?'Sending…':attempt.current?'Check / retry attempt':'Send reply'}</button></form>}
    </>}{notice&&<p role="status" className="mt-3 text-sm">{notice}</p>}
  </section>;
}
