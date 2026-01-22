import { NextResponse } from 'next/server';

function logout(req: Request) {
  const response = NextResponse.redirect(
    new URL('/login', req.url)
  );

  response.cookies.delete('auth_token');
  response.cookies.delete('user_role');
  response.cookies.delete('operator_id');
  response.cookies.delete('login_error');

  return response;
}

// ✅ SUPPORT BOTH METHODS
export async function GET(req: Request) {
  return logout(req);
}

export async function POST(req: Request) {
  return logout(req);
}
