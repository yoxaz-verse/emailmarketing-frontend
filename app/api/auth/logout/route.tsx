import { NextResponse } from "next/server";

export async function GET() {
  const res = NextResponse.redirect(
    new URL("/login", "http://localhost:3001")
  );

  res.cookies.delete({ name: "auth_token", path: "/" });
  res.cookies.delete({ name: "user_role", path: "/" });
  res.cookies.delete({ name: "operator_id", path: "/" });

  return res;
}
