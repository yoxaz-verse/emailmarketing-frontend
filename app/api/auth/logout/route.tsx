import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

async function logout(req: Request) {
  const cookieStore = await cookies();

  cookieStore.delete('auth_token');
  cookieStore.delete('user_role');
  cookieStore.delete('operator_id');
  cookieStore.delete('login_error');

  return NextResponse.redirect(new URL('/login', req.url));
}

export async function GET(req: Request) {
  return logout(req);
}

export async function POST(req: Request) {
  return logout(req);
}
