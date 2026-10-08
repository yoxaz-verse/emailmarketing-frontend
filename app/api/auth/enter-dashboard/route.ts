import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { isTokenExpired } from '@/lib/auth-session';
import { getApiBaseUrl } from '@/lib/server/api-config';

const SESSION_ENDED_PATH = '/api/auth/logout?reason=session-ended';

function redirectTo(req: Request, path: string) {
  return NextResponse.redirect(new URL(path, req.url));
}

export async function GET(req: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;

  if (!token || isTokenExpired(token)) {
    return redirectTo(req, SESSION_ENDED_PATH);
  }

  let apiBase: string;
  try {
    apiBase = getApiBaseUrl();
  } catch {
    return redirectTo(req, SESSION_ENDED_PATH);
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
      return redirectTo(req, SESSION_ENDED_PATH);
    }

    return redirectTo(req, '/dashboard');
  } catch (error) {
    console.error('[ENTER_DASHBOARD_AUTH_CHECK_FAILED]', {
      message: error instanceof Error ? error.message : 'unknown',
    });
    return redirectTo(req, '/dashboard');
  }
}
