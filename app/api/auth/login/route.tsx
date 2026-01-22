import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL!;
  const formData = await req.formData();

  const email = formData.get('email');
  const password = formData.get('password');

  if (!email || !password) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  const backendRes = await fetch(`${apiBase}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!backendRes.ok) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  const data = await backendRes.json();

  const response = NextResponse.redirect(
    new URL('/dashboard', req.url),
    { status: 303 }
  );

  response.cookies.set('auth_token', data.token, {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: false,
  });

  response.cookies.set('user_role', data.user.role, {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: false,
  });

  if (data.user.operator_id) {
    response.cookies.set('operator_id', data.user.operator_id, {
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
      secure: false,
    });
  }

  return response;
}
