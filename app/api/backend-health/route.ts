import { NextResponse } from 'next/server';
import { getApiBaseUrl } from '@/lib/server/api-config';

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
  const startedAt = performance.now();

  try {
    const upstream = await fetch(`${apiBase}/ping`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });

    const contentType = upstream.headers.get('content-type') || '';
    const raw = await upstream.text();
    let body: unknown = null;
    if (contentType.includes('application/json') && raw) {
      try {
        body = JSON.parse(raw);
      } catch {
        body = null;
      }
    }

    const durationMs = Math.round(performance.now() - startedAt);
    return NextResponse.json(
      {
        ok: upstream.ok && Boolean(body),
        backend: {
          configured: true,
          origin: backendUrl.origin,
          hostname: backendUrl.hostname,
        },
        upstream: {
          ok: upstream.ok,
          status: upstream.status,
          contentType,
          durationMs,
          body,
          error: upstream.ok ? null : 'Backend health check failed',
        },
      },
      { status: upstream.ok ? 200 : 502 }
    );
  } catch (error) {
    const durationMs = Math.round(performance.now() - startedAt);
    return NextResponse.json(
      {
        ok: false,
        backend: {
          configured: true,
          origin: backendUrl.origin,
          hostname: backendUrl.hostname,
        },
        upstream: {
          ok: false,
          status: null,
          contentType: null,
          durationMs,
          body: null,
          error: error instanceof Error ? error.message : 'Backend health check failed',
        },
      },
      { status: 503 }
    );
  }
}
