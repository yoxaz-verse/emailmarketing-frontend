import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ✅ DO NOT TOUCH API ROUTES
  if (pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  const token = req.cookies.get('auth_token')?.value;

  if (!token && pathname.startsWith('/dashboard')) {
    console.log(`[Middleware] No token found for ${pathname}, redirecting to /login`);
    return NextResponse.redirect(new URL('/login', req.url));
  }

  if (token && pathname === '/login') {
    console.log(`[Middleware] Token found, redirecting from /login to /dashboard`);
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard', '/dashboard/:path*', '/login'],
};
