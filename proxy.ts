import { NextRequest, NextResponse } from 'next/server';
import { isAllowedDashboardPathForRole } from '@/lib/dashboard-access';
import { clearAuthCookies, isTokenExpired } from '@/lib/auth-session';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ✅ DO NOT TOUCH API ROUTES
  if (pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  const token = req.cookies.get('auth_token')?.value;
  const role = req.cookies.get('user_role')?.value;
  const hasInvalidToken = Boolean(token) && isTokenExpired(token);

  if (!token && pathname.startsWith('/dashboard')) {
    console.log(`[Middleware] No token found for ${pathname}, redirecting to /login`);
    return NextResponse.redirect(new URL('/login', req.url));
  }

  if (hasInvalidToken && pathname.startsWith('/dashboard')) {
    console.log(`[Middleware] Expired or invalid token found for ${pathname}, redirecting to /login`);
    const response = NextResponse.redirect(new URL('/login?reason=session-expired', req.url));
    return clearAuthCookies(response);
  }

  if (hasInvalidToken && (pathname === '/' || pathname === '/login')) {
    const response = NextResponse.next();
    return clearAuthCookies(response);
  }

  if (token && !hasInvalidToken && pathname.startsWith('/dashboard') && !isAllowedDashboardPathForRole(role, pathname)) {
    console.log(`[Middleware] Non-admin route blocked for ${pathname}, redirecting to /dashboard`);
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  if (token && !hasInvalidToken && pathname === '/login') {
    console.log(`[Middleware] Token found, redirecting from /login to /dashboard`);
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/dashboard', '/dashboard/:path*', '/login'],
};
