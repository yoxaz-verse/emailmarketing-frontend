// lib/client-fetch.ts
export async function clientFetch<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_BASE_URL}${path}`,
      {
        ...options,
        credentials: 'include', // send cookies
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {})
        }
      }
    );
  
    if (!res.ok) {
      throw new Error(await res.text());
    }
  
    return res.json();
  }
  