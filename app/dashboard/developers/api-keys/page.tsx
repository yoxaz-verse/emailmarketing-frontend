import Link from 'next/link';
import { loadPublicOpenApi } from '@/lib/server/public-openapi';
import ApiKeysClient from './ApiKeysClient';

export default async function ApiKeysPage() {
  const { baseUrl, spec } = await loadPublicOpenApi();
  return <div className="mx-auto max-w-6xl"><div className="mb-6 flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-primary">Developers</p><h1 className="mt-2 text-3xl font-bold">API keys & explorer</h1><p className="mt-2 text-sm text-muted-foreground">Create scoped tokens and connect other platforms to OBAOL.</p></div><Link className="text-sm text-primary hover:underline" href="/developers/api">Public API guide →</Link></div><ApiKeysClient baseUrl={baseUrl} spec={spec}/></div>;
}
