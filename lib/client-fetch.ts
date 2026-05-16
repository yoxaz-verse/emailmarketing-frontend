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
    const raw = await res.text();
    const lower = raw.toLowerCase();
    const isConfirmedAuthFailure =
      lower.includes('unauthorized') ||
      lower.includes('invalid token') ||
      lower.includes('authentication required') ||
      lower.includes('user disabled');

    if (isConfirmedAuthFailure && typeof window !== 'undefined') {
      window.location.href = '/api/auth/logout';
      throw new Error('UNAUTHORIZED');
    }

    throw new Error(raw || `Request failed with status ${res.status}`);
  }

  if (!res.ok) {
    throw new Error(await res.text());
  }

  return res.json();
}
