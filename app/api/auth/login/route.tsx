import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json();
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!apiBase) {
    return NextResponse.json(
      { error: 'API base URL not configured' },
      { status: 500 }
    );
  }
  const isProd = false

  const res = await fetch(`${apiBase}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const data = await res.json();

  const response = NextResponse.json({ success: true });

  response.cookies.set('auth_token', data.token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/'
  });

  response.cookies.set('user_role', data.user.role, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/'
  });

  if (data.user.operator_id) {
    response.cookies.set('operator_id', data.user.operator_id, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/'
    });
  }

  return response;
}
