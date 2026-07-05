import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getApiBaseUrl } from '@/lib/server/api-config';

type ProxyErrorStatus = 'backend_unavailable' | 'route_missing' | 'upstream_error' | 'misconfigured';

type ProxyErrorBody = {
  error: string;
  status: ProxyErrorStatus;
  detail?: string;
};

export async function GET() {
  const UPSTREAM_TIMEOUT_MS = 12000;
  let apiBase: string;
  try {
    apiBase = getApiBaseUrl();
  } catch (error) {
    return NextResponse.json<ProxyErrorBody>(
      {
        error: error instanceof Error ? error.message : 'NEXT_PUBLIC_API_BASE_URL is invalid.',
        status: 'misconfigured',
      },
      { status: 500 }
    );
  }

  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;

  let upstream: Response;
  try {
    upstream = await fetch(`${apiBase}/stats/operations-summary`, {
      method: 'GET',
      cache: 'no-store',
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  } catch (error) {
    const isTimeout =
      error instanceof Error &&
      (error.name === 'TimeoutError' ||
        error.name === 'AbortError' ||
        error.message.toLowerCase().includes('timed out'));
    const message = isTimeout
      ? `Upstream request timed out after ${UPSTREAM_TIMEOUT_MS}ms`
      : error instanceof Error
        ? error.message
        : 'Unknown network error';
    return NextResponse.json<ProxyErrorBody>(
      {
        error: 'Backend unavailable',
        status: 'backend_unavailable',
        detail: message,
      },
      { status: 503 }
    );
  }

  if (!upstream.ok) {
    const raw = await upstream.text();
    const lower = raw.toLowerCase();
    const isRouteMissing =
      upstream.status === 404 &&
      (lower.includes('cannot get /stats/operations-summary') ||
        lower.includes('not found'));

    return NextResponse.json<ProxyErrorBody>(
      {
        error: isRouteMissing
          ? 'Operations summary route missing in backend runtime'
          : `Backend returned ${upstream.status}`,
        status: isRouteMissing ? 'route_missing' : 'upstream_error',
        detail: raw.slice(0, 500),
      },
      { status: upstream.status }
    );
  }

  const payload = await upstream.json();
  return NextResponse.json(payload, { status: 200 });
}
