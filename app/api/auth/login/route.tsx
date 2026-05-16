import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

type LoginBackendResponse = {
  token?: string;
  user?: {
    role?: string;
    operator_id?: string | null;
  };
  error?: string;
  message?: string;
};

export async function POST(req: Request) {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
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

  if (!apiBase || apiBase.trim() === '') {
    const errorMessage = 'NEXT_PUBLIC_API_BASE_URL is missing. Set it in dashboard/.env.local.';
    if (contentType.includes('application/json')) {
      return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(errorMessage)}`, req.url));
  }

  let backendRes: Response;
  try {
    backendRes = await fetch(`${apiBase}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
  } catch (error) {
    console.error('[AUTH LOGIN] Backend fetch failed:', error);
    const errorMessage = 'Backend is unreachable. Please ensure backend server is running.';
    if (contentType.includes('application/json')) {
      return NextResponse.json({ error: errorMessage }, { status: 503 });
    }
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(errorMessage)}`, req.url));
  }

  const responseText = await backendRes.text();
  let backendData: LoginBackendResponse | null = null;
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
    const status =
      backendRes.status >= 400 && backendRes.status <= 599
        ? backendRes.status
        : 401;

    if (contentType.includes('application/json')) {
      return NextResponse.json({ error: errorMessage }, { status });
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
  const isSecureRequest = new URL(req.url).protocol === 'https:';
  const shouldUseSecureCookies = process.env.NODE_ENV === 'production' || isSecureRequest;
  const requestHost = req.headers.get('host') || 'unknown-host';

  // ✅ MODERN COOKIE SETTING (Next.js 15 compatible)
  cookieStore.set('auth_token', data.token, {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: shouldUseSecureCookies,
    maxAge: 60 * 60 * 24 * 7, // 1 week
  });

  cookieStore.set('user_role', data.user.role, {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: shouldUseSecureCookies,
    maxAge: 60 * 60 * 24 * 7,
  });

  if (data.user.operator_id) {
    cookieStore.set('operator_id', data.user.operator_id, {
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
      secure: shouldUseSecureCookies,
      maxAge: 60 * 60 * 24 * 7,
    });
  }

  if (contentType.includes('application/json')) {
    console.info('[AUTH_LOGIN_COOKIE_SET]', {
      host: requestHost,
      isSecureRequest,
      shouldUseSecureCookies,
      sameSite: 'lax',
      hasOperatorId: Boolean(data.user.operator_id),
    });
    return NextResponse.json({ success: true, user: data.user });
  }

  console.info('[AUTH_LOGIN_COOKIE_SET]', {
    host: requestHost,
    isSecureRequest,
    shouldUseSecureCookies,
    sameSite: 'lax',
    hasOperatorId: Boolean(data.user.operator_id),
  });
  return NextResponse.redirect(new URL('/dashboard', req.url), { status: 303 });
}
