import type { Metadata } from 'next';
import { loadPublicOpenApi } from '@/lib/server/public-openapi';
import ApiGuide from './ApiGuide';

export const metadata: Metadata = { title: 'API Guide', description: 'Connect external tools to OBAOL with scoped API keys.' };
export const dynamic = 'force-dynamic';

export default async function ApiGuidePage() {
  const { baseUrl, spec } = await loadPublicOpenApi();
  return <ApiGuide baseUrl={baseUrl} spec={spec} />;
}
