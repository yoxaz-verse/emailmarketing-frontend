// lib/server-fetch.ts
import { cookies } from 'next/headers';

export async function serverFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;

  if (!token) {
    throw new Error('Not authenticated');
  }

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_BASE_URL}${path}`,
    {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(options.headers || {})
      },
      cache: 'no-store'
    }
  );



  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || 'API request failed');
  }
  
  return res.json();
}
