import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

async function proxy(req: NextRequest, path: string[]) {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!apiBase || apiBase.trim() === '') {
    return NextResponse.json(
      { ok: false, error: 'NEXT_PUBLIC_API_BASE_URL is missing' },
      { status: 500 }
    );
  }

  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  const incomingAuth = req.headers.get('authorization');

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  const incomingContentType = req.headers.get('content-type');
  if (incomingContentType) {
    headers['Content-Type'] = incomingContentType;
  }

  if (incomingAuth) {
    headers.Authorization = incomingAuth;
  } else if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const backendPath = path.join('/');
  const query = req.nextUrl.search;
  const url = `${apiBase}/${backendPath}${query}`;
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';

  try {
    const upstream = await fetch(url, {
      method: req.method,
      headers,
      body: hasBody ? await req.text() : undefined,
      cache: 'no-store',
    });

    const raw = await upstream.text();
    const contentType = upstream.headers.get('content-type') || '';
    const status = upstream.status;
    const shouldLog =
      backendPath === 'auth/me' ||
      status >= 400;

    if (shouldLog) {
      console.info('[API_PROXY_TRACE]', {
        method: req.method,
        backendPath: `/${backendPath}`,
        status,
      });
    }

    if (contentType.includes('application/json')) {
      const parsed = raw ? JSON.parse(raw) : {};
      return NextResponse.json(parsed, { status });
    }

    return new NextResponse(raw, { status });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Proxy error';
    console.error('[API_PROXY_ERROR]', {
      method: req.method,
      backendPath: `/${backendPath}`,
      message,
    });
    return NextResponse.json(
      { ok: false, error: 'Backend unavailable', detail: message },
      { status: 503 }
    );
  }
}

type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxy(req, path);
}

export async function POST(req: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxy(req, path);
}

export async function PUT(req: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxy(req, path);
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxy(req, path);
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxy(req, path);
}
