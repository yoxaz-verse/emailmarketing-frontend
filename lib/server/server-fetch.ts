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

  const res = await fetch(
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

  console.log('[serverFetch] status:', res.status);

  if (res.status === 401 || res.status === 403) {
    throw new Error('UNAUTHORIZED');
  }

  if (!res.ok) {
    throw new Error(await res.text());
  }

  return res.json();
}
