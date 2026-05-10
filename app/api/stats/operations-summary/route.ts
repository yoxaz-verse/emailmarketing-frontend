import { NextResponse } from 'next/server';

type ProxyErrorStatus = 'backend_unavailable' | 'route_missing' | 'upstream_error' | 'misconfigured';

type ProxyErrorBody = {
  error: string;
  status: ProxyErrorStatus;
  detail?: string;
};

export async function GET() {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!apiBase || apiBase.trim() === '') {
    return NextResponse.json<ProxyErrorBody>(
      {
        error: 'NEXT_PUBLIC_API_BASE_URL is missing.',
        status: 'misconfigured',
      },
      { status: 500 }
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${apiBase}/stats/operations-summary`, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown network error';
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
