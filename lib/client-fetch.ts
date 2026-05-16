// lib/client-fetch.ts
export async function clientFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = normalizedPath.startsWith('/api/')
    ? normalizedPath
    : `/api/proxy${normalizedPath}`;

  const res = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  if (res.status === 401 || res.status === 403) {
    if (typeof window !== 'undefined') {
      window.location.href = '/api/auth/logout';
    }
    throw new Error('UNAUTHORIZED');
  }

  if (!res.ok) {
    throw new Error(await res.text());
  }

  return res.json();
}
