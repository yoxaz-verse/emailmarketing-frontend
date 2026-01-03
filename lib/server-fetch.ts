import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export async function serverFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;

  if (!token) {
    redirect('/login');
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

  // ✅ THIS IS ENOUGH
// 🔑 SESSION INVALID → CLEANUP VIA ROUTE HANDLER
if (res.status === 401 || res.status === 403) {
  redirect("/api/auth/logout");

  // Then redirect
}



  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || 'API request failed');
  }

  return res.json();
}
