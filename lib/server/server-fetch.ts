'use server';

import { cookies } from 'next/headers';

export async function serverFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const cookieStore = await cookies(); // ✅ REQUIRED
  const token = cookieStore.get('auth_token')?.value;

  console.log('[serverFetch] path:', path);
  console.log('[serverFetch] token exists:', Boolean(token));

  let res: Response;
  try {
    res = await fetch(
      `${process.env.NEXT_PUBLIC_API_BASE_URL}${path}`,
      {
        ...options,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
        cache: 'no-store',
      }
    );
  } catch (err: any) {
    const message = String(err?.message ?? '').toLowerCase();
    if (
      message.includes('fetch failed') ||
      message.includes('econnrefused') ||
      message.includes('socket')
    ) {
      throw new Error('Backend unavailable. Please ensure backend is running and retry.');
    }
    throw err;
  }

  console.log('[serverFetch] status:', res.status);

  if (res.status === 401 || res.status === 403) {
    throw new Error('UNAUTHORIZED');
  }

  if (!res.ok) {
    const raw = await res.text();
    let parsed: any = null;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      parsed = null;
    }

    const message =
      parsed?.error ||
      parsed?.message ||
      (typeof parsed === 'string' ? parsed : null) ||
      raw ||
      `Request failed with status ${res.status}`;

    const error = new Error(message) as Error & {
      statusCode?: number;
      raw?: string;
    };
    error.statusCode = res.status;
    error.raw = raw;
    throw error;
  }

  return res.json();
}
