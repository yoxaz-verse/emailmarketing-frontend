import { NextResponse } from 'next/server';
import { appendParentDomainAuthCookieClears, authCookieMaxAge } from '@/lib/auth-session';
import { getApiBaseUrl } from '@/lib/server/api-config';

type LoginBackendResponse = {
  token?: string;
  user?: {
    role?: string;
    operator_id?: string | null;
    access_flags?: Record<string, boolean>;
  };
  error?: string;
  message?: string;
};

type LoginBackendSuccess = {
  token: string;
  user: {
    role: string;
    operator_id?: string | null;
    access_flags?: Record<string, boolean>;
  };
};

function isLoginBackendSuccess(data: LoginBackendResponse | null): data is LoginBackendSuccess {
  if (!data) return false;
  if (typeof data.token !== 'string' || data.token.trim() === '') return false;
  if (!data.user) return false;
  if (typeof data.user.role !== 'string' || data.user.role.trim() === '') return false;
  return true;
}

function backendHost(apiBase: string): string {
  try {
    return new URL(apiBase).host;
  } catch {
    return 'invalid-api-base';
  }
}

function isLikelyBackendUnavailable(status: number, contentType: string): boolean {
  if (status === 502 || status === 503 || status === 504) return true;
  return status >= 500 && !contentType.toLowerCase().includes('application/json');
}

export async function POST(req: Request) {
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

  let apiBase: string;
  try {
    apiBase = getApiBaseUrl();
  } catch (error) {
    const errorMessage = error instanceof Error
      ? error.message
      : 'NEXT_PUBLIC_API_BASE_URL is missing or invalid.';
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

  const backendContentType = backendRes.headers.get('content-type') || '';
  const responseText = await backendRes.text();
  let backendData: LoginBackendResponse | null = null;
  try {
    backendData = responseText ? JSON.parse(responseText) : null;
  } catch (e) {
    console.error('[AUTH LOGIN] JSON Parse Error:', {
      message: e instanceof Error ? e.message : 'unknown parse error',
      backendHost: backendHost(apiBase),
      status: backendRes.status,
      contentType: backendContentType,
    });
  }

  if (!backendRes.ok) {
    const backendUnavailable = isLikelyBackendUnavailable(backendRes.status, backendContentType);
    const errorMessage =
      backendData?.error ||
      backendData?.message ||
      (backendUnavailable
        ? 'Backend unavailable. Please check the backend service health and retry.'
        : 'Login failed. Backend returned invalid response.');
    const status =
      backendRes.status >= 400 && backendRes.status <= 599
        ? backendRes.status
        : 401;

    if (contentType.includes('application/json')) {
      return NextResponse.json({ error: errorMessage }, { status });
    }
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(errorMessage)}`, req.url));
  }

  if (!isLoginBackendSuccess(backendData)) {
    const errorMessage = 'Login failed. Backend returned invalid response.';
    if (contentType.includes('application/json')) {
      return NextResponse.json({ error: errorMessage }, { status: 401 });
    }
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(errorMessage)}`, req.url));
  }

  const data = backendData;
  const maxAge = authCookieMaxAge(data.token);
  if (maxAge <= 0) {
    const errorMessage = 'Login failed. Backend returned an expired or invalid session token.';
    if (contentType.includes('application/json')) {
      return NextResponse.json({ error: errorMessage }, { status: 401 });
    }
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(errorMessage)}`, req.url));
  }

  const isSecureRequest = new URL(req.url).protocol === 'https:';
  const shouldUseSecureCookies = process.env.NODE_ENV === 'production' || isSecureRequest;
  const requestHost = req.headers.get('host') || 'unknown-host';
  const forwardedHost = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const hostname = (forwardedHost || requestHost).replace(/:\d+$/, '');
  const cookieOptions = {
    httpOnly: true,
    path: '/',
    sameSite: 'lax' as const,
    secure: shouldUseSecureCookies,
    maxAge,
  };

  const response = contentType.includes('application/json')
    ? NextResponse.json({ success: true, user: data.user })
    : NextResponse.redirect(new URL('/dashboard', req.url), { status: 303 });

  // ✅ MODERN COOKIE SETTING (Next.js 15 compatible)
  response.cookies.set('auth_token', data.token, cookieOptions);

  response.cookies.set('user_role', data.user.role, cookieOptions);

  response.cookies.set('user_access_flags', encodeURIComponent(JSON.stringify(data.user.access_flags ?? {})), cookieOptions);

  if (data.user.operator_id) {
    response.cookies.set('operator_id', data.user.operator_id, cookieOptions);
  } else {
    response.cookies.set('operator_id', '', {
      ...cookieOptions,
      maxAge: 0,
      expires: new Date(0),
    });
  }

  // Remove legacy parent-domain cookies after issuing the canonical host-only session.
  appendParentDomainAuthCookieClears(response, {
    hostname,
    secure: shouldUseSecureCookies,
  });

  console.info('[AUTH_LOGIN_COOKIE_SET]', {
    host: requestHost,
    isSecureRequest,
    shouldUseSecureCookies,
    sameSite: 'lax',
    hasOperatorId: Boolean(data.user.operator_id),
    maxAge,
  });
  return response;
}
