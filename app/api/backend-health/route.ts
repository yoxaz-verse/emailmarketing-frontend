import { NextResponse } from 'next/server';
import { getApiBaseUrl } from '@/lib/server/api-config';

async function fetchJsonHealth(url: string) {
  const startedAt = performance.now();
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    const contentType = response.headers.get('content-type') || '';
    const raw = await response.text();
    let body: unknown = null;
    if (contentType.includes('application/json') && raw) {
      try {
        body = JSON.parse(raw);
      } catch {
        body = null;
      }
    }

    return {
      ok: response.ok && Boolean(body),
      status: response.status,
      contentType,
      durationMs: Math.round(performance.now() - startedAt),
      body,
      error: response.ok ? null : 'Backend health check failed',
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      contentType: null,
      durationMs: Math.round(performance.now() - startedAt),
      body: null,
      error: error instanceof Error ? error.message : 'Backend health check failed',
    };
  }
}

export async function GET() {
  let apiBase: string;
  try {
    apiBase = getApiBaseUrl();
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        backend: {
          configured: false,
          error: error instanceof Error ? error.message : 'NEXT_PUBLIC_API_BASE_URL is invalid',
        },
      },
      { status: 500 }
    );
  }

  const backendUrl = new URL(apiBase);

  const [upstream, authReadiness] = await Promise.all([
    fetchJsonHealth(`${apiBase}/ping`),
    fetchJsonHealth(`${apiBase}/ping/auth-readiness`),
  ]);

  const ok = upstream.ok && authReadiness.ok;
  return NextResponse.json(
    {
      ok,
      backend: {
        configured: true,
        origin: backendUrl.origin,
        hostname: backendUrl.hostname,
      },
      upstream,
      authReadiness: {
        ...authReadiness,
        error: authReadiness.ok
          ? null
          : authReadiness.error || 'Supabase auth readiness check failed',
      },
    },
    { status: ok ? 200 : 502 }
  );
}
