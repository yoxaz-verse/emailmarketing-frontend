import { NextResponse } from 'next/server';
import { clearAuthCookies } from '@/lib/auth-session';

async function logout(req: Request) {
  return clearAuthCookies(NextResponse.redirect(new URL('/login', req.url)));
}

export async function GET(req: Request) {
  return logout(req);
}

export async function POST(req: Request) {
  return logout(req);
}
