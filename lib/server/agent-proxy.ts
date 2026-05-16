import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

type Method = 'GET' | 'POST';

export async function proxyAgentRequest(req: Request, backendPath: string, method: Method) {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!apiBase || apiBase.trim() === '') {
    return NextResponse.json({ ok: false, error: 'NEXT_PUBLIC_API_BASE_URL is missing' }, { status: 500 });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  const incomingAuth = req.headers.get('authorization');

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };

  if (incomingAuth) {
    headers.Authorization = incomingAuth;
  } else if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const query = new URL(req.url).search;
  const url = `${apiBase}${backendPath}${query}`;

  try {
    const upstream = await fetch(url, {
      method,
      headers,
      body: method === 'POST' ? await req.text() : undefined,
      cache: 'no-store',
    });

    const raw = await upstream.text();
    const contentType = upstream.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const parsed = raw ? JSON.parse(raw) : {};
      return NextResponse.json(parsed, { status: upstream.status });
    }

    return new NextResponse(raw, { status: upstream.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Proxy error';
    return NextResponse.json({ ok: false, error: 'Backend unavailable', detail: message }, { status: 503 });
  }
}
