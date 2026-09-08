"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import { clientFetch } from './client-fetch';
export type CommunicationItem = {id:string;kind:'message'|'notification';source:string;title:string;preview:string;href:string|null;occurred_at:string;activity_at:string;unread:boolean};
export type Feed = {items:CommunicationItem[];total:number;unread_count:number;as_of:string};
export type Detail = {item:CommunicationItem;conversation:{subject:string;recipient:string;campaign_id:string|null}|null;messages:{id:string;direction:string;sender:string;recipient:string;subject:string;body:string|null;occurred_at:string;status:string}[];can_reply:boolean;reply_disabled_reason:string|null;as_of:string};
export const notifyCommunications=()=>window.dispatchEvent(new Event('communications:refresh'));
export function useCommunications<T>(path:string|null) {
  const [data,setData]=useState<T|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(Boolean(path));
  const generation=useRef(0);
  const refresh=useCallback(async()=>{
    if(!path)return;
    const current=++generation.current;
    setLoading(true);
    try {const next=await clientFetch<T>(path);if(current===generation.current){setData(next);setError('');}}
    catch(e){if(current===generation.current)setError(e instanceof Error?e.message:'Unable to refresh');}
    finally{if(current===generation.current)setLoading(false);}
  },[path]);
  useEffect(()=>{
    setData(null);setError('');void refresh();
    const tick=()=>{if(document.visibilityState==='visible')void refresh();};
    const timer=setInterval(tick,15000);
    document.addEventListener('visibilitychange',tick);window.addEventListener('communications:refresh',tick);
    return()=>{generation.current++;clearInterval(timer);document.removeEventListener('visibilitychange',tick);window.removeEventListener('communications:refresh',tick);};
  },[refresh]);
  return {data,error,loading,refresh};
}
export async function markRead(ids:string[]|null,before:string) {
  await clientFetch('/communications/read',{method:'POST',body:JSON.stringify({ids,before})});notifyCommunications();
}
