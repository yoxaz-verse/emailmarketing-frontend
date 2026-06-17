import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { clearAuthCookies, isTokenExpired } from '@/lib/auth-session';

const SESSION_EXPIRED_PATH = '/login?reason=session-expired';
const BACKEND_UNAVAILABLE_PATH = '/login?error=Backend unavailable. Please try again.';

function redirectTo(req: Request, path: string) {
  return NextResponse.redirect(new URL(path, req.url));
}

export async function GET(req: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;

  if (!token || isTokenExpired(token)) {
    return clearAuthCookies(redirectTo(req, SESSION_EXPIRED_PATH));
  }

  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!apiBase || apiBase.trim() === '') {
    return redirectTo(req, BACKEND_UNAVAILABLE_PATH);
  }

  try {
    const res = await fetch(`${apiBase}/auth/me`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    });

    if (res.ok) {
      return redirectTo(req, '/dashboard');
    }

    if (res.status === 401 || res.status === 403) {
      return clearAuthCookies(redirectTo(req, SESSION_EXPIRED_PATH));
    }

    return redirectTo(req, BACKEND_UNAVAILABLE_PATH);
  } catch (error) {
    console.error('[ENTER_DASHBOARD_AUTH_CHECK_FAILED]', {
      message: error instanceof Error ? error.message : 'unknown',
    });
    return redirectTo(req, BACKEND_UNAVAILABLE_PATH);
  }
}
