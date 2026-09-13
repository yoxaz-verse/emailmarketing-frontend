'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, Copy, Search, ArrowLeft } from 'lucide-react';

type Operation = { method: string; path: string; summary: string; scope?: string; request?: any };

function exampleBody(operation?: Operation) {
  if (!operation?.request) return '';
  const schema = operation.request.content?.['application/json']?.schema;
  const required = schema?.required ?? [];
  const values: Record<string, unknown> = {};
  for (const key of required) values[key] = key === 'email' ? 'person@example.com' : key === 'lead_ids' ? ['<lead-uuid>'] : key === 'sequence_id' ? '<sequence-uuid>' : 'Example';
  return JSON.stringify(values, null, 2);
}

function operations(spec: any): Operation[] {
  return Object.entries(spec?.paths ?? {}).flatMap(([path, methods]) =>
    Object.entries((methods ?? {}) as Record<string, any>).map(([method, value]) => ({
      method: method.toUpperCase(), path, summary: value.summary ?? '', scope: value['x-required-scope'], request: value.requestBody,
    })));
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return <button type="button" onClick={async () => { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? 'Copied' : 'Copy'}</button>;
}

export default function ApiGuide({ baseUrl, spec }: { baseUrl: string; spec: any | null }) {
  const [query, setQuery] = useState('');
  const [language, setLanguage] = useState<'curl' | 'javascript' | 'python' | 'n8n'>('curl');
  const [selected, setSelected] = useState(0);
  const all = useMemo(() => operations(spec), [spec]);
  const filtered = all.filter((item) => `${item.method} ${item.path} ${item.summary} ${item.scope ?? ''}`.toLowerCase().includes(query.toLowerCase()));
  const current = all[selected] ?? all[0];
  const url = `${baseUrl}/v1${current?.path ?? '/auth/check'}`;
  const sampleBody = exampleBody(current);
  const examples = {
    curl: `curl -X ${current?.method ?? 'GET'} '${url}' \\\n  -H 'X-API-Key: <YOUR_OBAOL_KEY>'${sampleBody ? ` \\\n  -H 'Content-Type: application/json' \\\n  -d '${sampleBody}'` : ''}`,
    javascript: `const response = await fetch('${url}', {\n  method: '${current?.method ?? 'GET'}',\n  headers: { 'X-API-Key': process.env.OBAOL_API_KEY!${sampleBody ? ", 'Content-Type': 'application/json'" : ''} },${sampleBody ? `\n  body: JSON.stringify(${sampleBody}),` : ''}\n});\nconst data = await response.json();`,
    python: `import os, requests\nresponse = requests.${(current?.method ?? 'GET').toLowerCase()}(\n    '${url}',\n    headers={'X-API-Key': os.environ['OBAOL_API_KEY']}${sampleBody ? `,\n    json=${sampleBody.replace(/\n/g, '')}` : ''}\n)\nresponse.raise_for_status()\nprint(response.json())`,
    n8n: `HTTP Request node\nMethod: ${current?.method ?? 'GET'}\nURL: ${url}\nAuthentication: None\nHeader: X-API-Key = {{$env.OBAOL_API_KEY}}${sampleBody ? '\nSend Body: JSON' : ''}\nStore the token in an n8n credential or environment variable, never in a public workflow.`,
  };
  return <main className="mx-auto max-w-7xl px-4 py-8 sm:px-8">
    <div className="flex flex-wrap items-center justify-between gap-3"><Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft size={16} /> OBAOL home</Link><Link href="/dashboard/developers/api-keys" className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Manage keys & try API</Link></div>
    <header className="mt-12 max-w-3xl"><p className="text-sm font-semibold uppercase tracking-[.2em] text-primary">Developers · v1</p><h1 className="mt-3 text-4xl font-bold sm:text-5xl">Connect OBAOL to your tools</h1><p className="mt-4 text-lg text-muted-foreground">Use a scoped API key to connect your CRM, automation platform, or custom service. The guide is public; data and live requests require a key.</p></header>
    <section className="mt-10 grid gap-4 md:grid-cols-3">
      <div className="rounded-2xl border bg-card p-5"><span className="text-xs text-primary">01</span><h2 className="mt-2 font-semibold">Create a key</h2><p className="mt-2 text-sm text-muted-foreground">Sign in, choose only the scopes needed, and copy the token when it appears. It cannot be shown again.</p></div>
      <div className="rounded-2xl border bg-card p-5"><span className="text-xs text-primary">02</span><h2 className="mt-2 font-semibold">Set the base URL</h2><code className="mt-2 block break-all text-xs">{baseUrl ? `${baseUrl}/v1` : 'API backend not configured'}</code></div>
      <div className="rounded-2xl border bg-card p-5"><span className="text-xs text-primary">03</span><h2 className="mt-2 font-semibold">Send the header</h2><code className="mt-2 block text-xs">X-API-Key: obaol_live_…</code><p className="mt-2 text-xs text-muted-foreground">Verify with GET /v1/auth/check.</p></div>
    </section>
    <section className="mt-10 rounded-2xl border bg-card p-6"><h2 className="text-xl font-semibold">How requests work</h2><div className="mt-4 grid gap-5 text-sm text-muted-foreground md:grid-cols-3"><p><strong className="block text-foreground">Pagination</strong>Use page and page_size (1–100). Lists return page, page_size, total, and data.</p><p><strong className="block text-foreground">Errors</strong>Failures include error.code, error.message, and request_id. Save the request ID for support.</p><p><strong className="block text-foreground">Limits & retries</strong>Observe RateLimit-* and Retry-After headers. Use Idempotency-Key on supported write requests.</p></div></section>
    <section className="mt-12 grid gap-6 lg:grid-cols-[minmax(250px,340px)_1fr]"><div><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground"/><input aria-label="Search endpoints" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search endpoints or scopes" className="w-full rounded-xl border bg-card py-2 pl-10 pr-3 text-sm"/></div><div className="mt-3 max-h-[680px] space-y-2 overflow-y-auto">{filtered.map((item) => { const index = all.indexOf(item); return <button key={`${item.method}:${item.path}`} onClick={() => setSelected(index)} className={`w-full rounded-xl border p-3 text-left ${selected === index ? 'border-primary bg-primary/10' : 'bg-card hover:bg-muted'}`}><span className="font-mono text-xs text-primary">{item.method}</span> <span className="break-all font-mono text-xs">{item.path}</span><span className="mt-1 block text-xs text-muted-foreground">{item.summary}</span></button>; })}{!filtered.length && <p className="p-4 text-sm text-muted-foreground">No matching endpoints.</p>}</div></div>
      <div className="min-w-0 rounded-2xl border bg-card p-5 sm:p-7"><h2 className="text-xl font-semibold">{current?.summary ?? 'API catalog unavailable'}</h2>{current && <><p className="mt-2 break-all font-mono text-sm"><span className="text-primary">{current.method}</span> {current.path}</p><p className="mt-2 text-sm text-muted-foreground">Scope: {current.scope ?? 'Any valid key'}</p><div className="mt-6 flex flex-wrap gap-2">{(['curl','javascript','python','n8n'] as const).map((item) => <button key={item} onClick={() => setLanguage(item)} className={`rounded-lg px-3 py-1.5 text-xs ${language === item ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>{item}</button>)}</div><div className="mt-3 rounded-xl bg-background p-4"><div className="mb-2 text-right"><CopyButton value={examples[language]} /></div><pre className="overflow-x-auto whitespace-pre-wrap break-all text-xs leading-6">{examples[language]}</pre></div></>}{!spec && <p className="mt-3 text-sm text-muted-foreground">The live API catalog is temporarily unavailable. Check the backend URL and deployment.</p>}<p className="mt-6 text-xs text-muted-foreground">Keep keys server-side where possible. Browser requests require your origin on the API CORS allowlist.</p></div>
    </section>
    {spec && <a href={`${baseUrl}/v1/openapi.json`} className="mt-8 inline-block text-sm text-primary hover:underline">Download OpenAPI JSON →</a>}
  </main>;
}
