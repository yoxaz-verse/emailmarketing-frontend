import { NextResponse } from 'next/server';
import { clearAuthCookies } from '@/lib/auth-session';

async function logout(req: Request) {
  const url = new URL(req.url);
  const loginUrl = new URL('/login', req.url);
  if (url.searchParams.get('reason') === 'session-expired') {
    loginUrl.searchParams.set('reason', 'session-expired');
  }

  return clearAuthCookies(NextResponse.redirect(loginUrl));
}

export async function GET(req: Request) {
  return logout(req);
}

export async function POST(req: Request) {
  return logout(req);
}
