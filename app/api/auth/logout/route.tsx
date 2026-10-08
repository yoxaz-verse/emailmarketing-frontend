import { NextResponse } from 'next/server';
import { clearAuthCookies } from '@/lib/auth-session';

async function logout(req: Request) {
  const url = new URL(req.url);
  const forwardedHost = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const requestHost = forwardedHost || req.headers.get('host') || url.host;
  const hostname = requestHost.replace(/:\d+$/, '');
  const forwardedProtocol = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const loginUrl = new URL('/login', req.url);
  const reason = url.searchParams.get('reason');
  if (reason === 'session-ended' || reason === 'session-expired' || reason === 'backend-unavailable') {
    loginUrl.searchParams.set('reason', 'session-ended');
  }

  return clearAuthCookies(NextResponse.redirect(loginUrl), {
    hostname,
    secure: forwardedProtocol === 'https' || url.protocol === 'https:',
  });
}

export async function GET(req: Request) {
  return logout(req);
}

export async function POST(req: Request) {
  return logout(req);
}
