'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { clientFetch } from '@/lib/client-fetch';
import { Check, Copy, RefreshCw, ShieldAlert, Trash2 } from 'lucide-react';

type KeyRow = { id: string; name: string; key_prefix: string; scopes: string[]; owner_email?: string | null; operator_id: string; created_at: string; expires_at?: string | null; last_used_at?: string | null; status: string; user_id: string };
type KeyList = { keys: KeyRow[]; available_scopes: string[]; operator_id?: string | null; is_admin: boolean };
type Operation = { method: string; path: string; summary: string; scope?: string; request?: any; idempotent?: boolean };
const scopeLabels: Record<string, string> = { 'leads:read': 'Read leads', 'leads:write': 'Write leads', 'campaigns:read': 'Read campaigns', 'campaigns:write': 'Write campaigns', 'campaigns:control': 'Start/pause campaigns', 'sequences:read': 'Read sequences', 'reports:read': 'Read reports' };
const dt = (value?: string | null) => value ? new Date(value).toLocaleString() : '—';
const keyError = (error: unknown) => {
  const message = error instanceof Error ? error.message : 'Could not load API keys.';
  return /api_keys|column .* does not exist|schema cache|migration/i.test(message)
    ? 'API Keys is not ready: the database is missing the public API migration. Ask an administrator to follow Backend/sql/README.md, then refresh.'
    : message;
};
const operations = (spec: any): Operation[] => Object.entries(spec?.paths ?? {}).flatMap(([path, methods]) => Object.entries((methods ?? {}) as Record<string, any>).map(([method, operation]) => ({ method: method.toUpperCase(), path, summary: operation.summary ?? '', scope: operation['x-required-scope'], request: operation.requestBody, idempotent: (operation.parameters ?? []).some((parameter: any) => parameter.name === 'Idempotency-Key') })));

export default function ApiKeysClient({ baseUrl, spec }: { baseUrl: string; spec: any | null }) {
  const [info, setInfo] = useState<KeyList | null>(null);
  const [operators, setOperators] = useState<Array<{ id: string; name: string }>>([]);
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<string[]>(['leads:read']);
  const [operatorId, setOperatorId] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [oneTimeToken, setOneTimeToken] = useState('');
  const [explorerToken, setExplorerToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [operationIndex, setOperationIndex] = useState(0);
  const [pathId, setPathId] = useState('');
  const [requestBody, setRequestBody] = useState('{}');
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [response, setResponse] = useState('');
  const [responseStatus, setResponseStatus] = useState('');
  const ops = useMemo(() => operations(spec), [spec]);
  const selectedOp = ops[operationIndex];

  const refresh = useCallback(async () => {
    setLoading(true); setLoadError('');
    try {
      const result = await clientFetch<KeyList>('/developer-keys');
      setInfo(result);
      if (result.is_admin) {
        const rows = await clientFetch<Array<{ id: string; name: string }>>('/crud/operators');
        setOperators(rows);
      }
    } catch (error) { setInfo(null); setLoadError(keyError(error)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  async function create() {
    setBusy(true); setMessage(''); setOneTimeToken('');
    try {
      const result = await clientFetch<{ key: KeyRow; token: string }>('/developer-keys', { method: 'POST', body: JSON.stringify({ name, scopes, operator_id: info?.is_admin ? operatorId : undefined, expires_at: expiresAt ? new Date(expiresAt).toISOString() : null }) });
      setOneTimeToken(result.token); setName(''); setMessage('Key created. Copy the token now—it will not be shown again.');
      await refresh();
    } catch (error) { setMessage(keyError(error)); }
    finally { setBusy(false); }
  }
  async function act(key: KeyRow, action: 'revoke' | 'rotate') {
    if (!window.confirm(action === 'revoke' ? `Revoke “${key.name}” immediately?` : `Rotate “${key.name}”? The old key will stop working immediately.`)) return;
    setBusy(true); setMessage(''); setOneTimeToken('');
    try {
      const result = await clientFetch<{ token?: string }>(`/developer-keys/${key.id}/${action}`, { method: 'POST' });
      if (result.token) { setOneTimeToken(result.token); setMessage('Key rotated. Copy the new token now—it will not be shown again.'); }
      else setMessage('Key revoked.');
      await refresh();
    } catch (error) { setMessage(keyError(error)); }
    finally { setBusy(false); }
  }
  async function copy() {
    await navigator.clipboard.writeText(oneTimeToken); setCopied(true); setTimeout(() => setCopied(false), 1500);
  }
  async function tryRequest() {
    if (!selectedOp || !baseUrl || !explorerToken.trim()) return;
    if (selectedOp.method !== 'GET' && !window.confirm('This is a live API operation and may change data. Continue?')) return;
    setBusy(true); setResponse(''); setResponseStatus('');
    try {
      const path = selectedOp.path.replace('{id}', encodeURIComponent(pathId.trim()));
      if (path.includes('{')) throw new Error('Enter the required path ID.');
      const url = `${baseUrl}/v1${path}`;
      const headers: Record<string, string> = { 'X-API-Key': explorerToken.trim() };
      if (selectedOp.idempotent && idempotencyKey.trim()) headers['Idempotency-Key'] = idempotencyKey.trim();
      let body: string | undefined;
      if (selectedOp.request) { JSON.parse(requestBody); headers['Content-Type'] = 'application/json'; body = requestBody; }
      const result = await fetch(url, { method: selectedOp.method, headers, body, credentials: 'omit', cache: 'no-store' });
      setResponseStatus(`${result.status} ${result.statusText}`);
      setResponse(JSON.stringify(await result.json(), null, 2));
    } catch (error) { setResponseStatus('Request failed'); setResponse(error instanceof Error ? error.message : 'Unknown error'); }
    finally { setBusy(false); }
  }

  return <div className="space-y-7">
    {loadError && <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">{loadError} <button onClick={() => void refresh()} className="ml-2 underline">Retry</button></div>}
    <section className="rounded-2xl border bg-card p-5 sm:p-7"><div className="flex items-start gap-3"><ShieldAlert className="mt-1 shrink-0 text-primary" size={20}/><div><h2 className="text-xl font-semibold">Create a scoped key</h2><p className="mt-1 text-sm text-muted-foreground">Use the minimum permissions your integration needs. Keep the token in a secrets manager or platform credential store.</p></div></div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2"><label className="text-sm">Key name<input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="CRM sync" className="mt-1 w-full rounded-xl border bg-background p-3"/></label><label className="text-sm">Expires at (optional)<input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="mt-1 w-full rounded-xl border bg-background p-3"/></label>{info?.is_admin && <label className="text-sm sm:col-span-2">Target operator<select value={operatorId} onChange={(e) => setOperatorId(e.target.value)} className="mt-1 w-full rounded-xl border bg-background p-3"><option value="">Choose an operator</option>{operators.map((operator) => <option key={operator.id} value={operator.id}>{operator.name} · {operator.id}</option>)}</select></label>}</div>
      <fieldset className="mt-5"><legend className="text-sm font-medium">Permissions</legend><div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{(info?.available_scopes ?? []).map((scope) => <label key={scope} className="flex items-center gap-2 rounded-lg border p-3 text-sm"><input type="checkbox" checked={scopes.includes(scope)} onChange={(e) => setScopes((current) => e.target.checked ? [...current, scope] : current.filter((item) => item !== scope))}/><span>{scopeLabels[scope] ?? scope}</span></label>)}</div></fieldset>
      <button disabled={busy || loading || !info || !name.trim() || !scopes.length || Boolean(info?.is_admin && !operatorId)} onClick={create} className="mt-5 rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-50">Create key</button>
      {message && <p role="status" className="mt-4 text-sm text-primary">{message}</p>}
      {oneTimeToken && <div className="mt-4 rounded-xl border border-primary/40 bg-primary/10 p-4"><p className="text-sm font-semibold">One-time token — save it now</p><code className="mt-2 block break-all text-xs">{oneTimeToken}</code><button onClick={copy} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">{copied ? <Check size={14}/> : <Copy size={14}/>} {copied ? 'Copied' : 'Copy token'}</button><button onClick={() => setOneTimeToken('')} className="ml-3 text-xs text-muted-foreground hover:underline">Dismiss</button></div>}
    </section>
    <section className="rounded-2xl border bg-card p-5 sm:p-7"><div className="flex items-center justify-between"><h2 className="text-xl font-semibold">Issued keys</h2><button aria-label="Refresh keys" disabled={loading} onClick={() => void refresh()} className="text-primary disabled:opacity-50"><RefreshCw size={18}/></button></div><div className="mt-4 space-y-3">{loading && <p role="status" className="text-sm text-muted-foreground">Loading API keys…</p>}{!loading && info?.keys.map((key) => <div key={key.id} className="rounded-xl border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">{key.name} <span className="ml-2 rounded-full bg-muted px-2 py-1 text-xs font-normal">{key.status}</span></h3><p className="mt-1 font-mono text-xs text-muted-foreground">{key.key_prefix}…</p></div>{key.status === 'active' && <div className="flex gap-2"><button disabled={busy} onClick={() => void act(key, 'rotate')} className="rounded-lg border px-3 py-2 text-xs hover:bg-muted"><RefreshCw size={13} className="mr-1 inline"/>Rotate</button><button disabled={busy} onClick={() => void act(key, 'revoke')} className="rounded-lg border px-3 py-2 text-xs text-destructive hover:bg-muted"><Trash2 size={13} className="mr-1 inline"/>Revoke</button></div>}</div><p className="mt-3 text-xs text-muted-foreground">Owner: {key.owner_email ?? key.user_id} · Operator: {key.operator_id}</p><p className="mt-1 text-xs text-muted-foreground">Created: {dt(key.created_at)} · Expires: {dt(key.expires_at)} · Last used: {dt(key.last_used_at)}</p><div className="mt-2 flex flex-wrap gap-1">{key.scopes.map((scope) => <span key={scope} className="rounded bg-primary/10 px-2 py-1 text-xs text-primary">{scope}</span>)}</div></div>)}{!loading && info && !info.keys.length && <p className="text-sm text-muted-foreground">No scoped API keys yet.</p>}</div></section>
    <section className="rounded-2xl border bg-card p-5 sm:p-7"><h2 className="text-xl font-semibold">Live API explorer</h2><p className="mt-1 text-sm text-muted-foreground">Requests are sent directly to the configured backend. The token stays in this page’s memory and is cleared when you leave or reload.</p>{!spec && <p className="mt-4 text-sm text-destructive">The OpenAPI catalog is unavailable.</p>}{spec && <div className="mt-5 grid gap-4"><label className="text-sm">Token<input type="password" autoComplete="off" spellCheck={false} value={explorerToken} onChange={(e) => setExplorerToken(e.target.value)} placeholder="obaol_live_…" className="mt-1 w-full rounded-xl border bg-background p-3 font-mono text-xs"/></label><label className="text-sm">Operation<select value={operationIndex} onChange={(e) => { setOperationIndex(Number(e.target.value)); setResponse(''); }} className="mt-1 w-full rounded-xl border bg-background p-3">{ops.map((op, index) => <option key={`${op.method}:${op.path}`} value={index}>{op.method} {op.path} — {op.summary}</option>)}</select></label>{selectedOp?.path.includes('{id}') && <label className="text-sm">Path ID<input value={pathId} onChange={(e) => setPathId(e.target.value)} placeholder="UUID" className="mt-1 w-full rounded-xl border bg-background p-3 font-mono text-xs"/></label>}{selectedOp?.request && <label className="text-sm">JSON body<textarea value={requestBody} onChange={(e) => setRequestBody(e.target.value)} rows={7} className="mt-1 w-full rounded-xl border bg-background p-3 font-mono text-xs"/></label>}{selectedOp?.idempotent && <label className="text-sm">Idempotency-Key (optional)<input value={idempotencyKey} onChange={(e) => setIdempotencyKey(e.target.value)} placeholder="Unique per operation, 8–128 characters" className="mt-1 w-full rounded-xl border bg-background p-3 font-mono text-xs"/></label>}<button disabled={busy || !explorerToken.trim()} onClick={() => void tryRequest()} className="w-fit rounded-xl bg-primary px-5 py-2 font-semibold text-primary-foreground disabled:opacity-50">Send live request</button>{response && <div><p className="mb-2 text-sm font-semibold">{responseStatus}</p><pre className="max-h-96 overflow-auto rounded-xl bg-background p-4 text-xs">{response}</pre></div>}</div>}</section>
  </div>;
}
