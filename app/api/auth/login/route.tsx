import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(req: Request) {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL!;
  const contentType = req.headers.get('content-type') || '';

  let email, password;

  if (contentType.includes('application/json')) {
    const body = await req.json();
    email = body.email;
    password = body.password;
  } else {
    const formData = await req.formData();
    email = formData.get('email');
    password = formData.get('password');
  }

  if (!email || !password) {
    if (contentType.includes('application/json')) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }
    return NextResponse.redirect(new URL('/login?error=Email and password are required', req.url));
  }

  const backendRes = await fetch(`${apiBase}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const responseText = await backendRes.text();
  let backendData: any = null;
  try {
    backendData = responseText ? JSON.parse(responseText) : null;
  } catch (e) {
    console.error('[AUTH LOGIN] JSON Parse Error:', e);
  }

  if (!backendRes.ok) {
    const errorMessage =
      backendData?.error ||
      backendData?.message ||
      'Login failed. Backend unavailable or returned invalid response.';

    if (contentType.includes('application/json')) {
      return NextResponse.json({ error: errorMessage }, { status: 401 });
    }
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(errorMessage)}`, req.url));
  }

  if (!backendData?.token || !backendData?.user) {
    const errorMessage = 'Login failed. Backend returned invalid response.';
    if (contentType.includes('application/json')) {
      return NextResponse.json({ error: errorMessage }, { status: 401 });
    }
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(errorMessage)}`, req.url));
  }

  const data = backendData;
  const cookieStore = await cookies();

  // ✅ MODERN COOKIE SETTING (Next.js 15 compatible)
  cookieStore.set('auth_token', data.token, {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: false, // Set to true for production HTTPS
    maxAge: 60 * 60 * 24 * 7, // 1 week
  });

  cookieStore.set('user_role', data.user.role, {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: false,
    maxAge: 60 * 60 * 24 * 7,
  });

  if (data.user.operator_id) {
    cookieStore.set('operator_id', data.user.operator_id, {
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
      secure: false,
      maxAge: 60 * 60 * 24 * 7,
    });
  }

  if (contentType.includes('application/json')) {
    return NextResponse.json({ success: true, user: data.user });
  }

  return NextResponse.redirect(new URL('/dashboard', req.url), { status: 303 });
}
