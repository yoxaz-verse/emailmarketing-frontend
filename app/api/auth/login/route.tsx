import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;

  if (!apiBase) {
    return NextResponse.json(
      { error: "API base URL not configured" },
      { status: 500 }
    );
  }

  // 1️⃣ READ HTML FORM DATA (IMPORTANT)
  const formData = await req.formData();
  const email = formData.get("email");
  const password = formData.get("password");

  if (!email || !password) {
    return NextResponse.redirect(
      new URL("/login", req.url)
    );
  }

  // 2️⃣ CALL YOUR EXISTING BACKEND LOGIN API (UNCHANGED)
  const res = await fetch(`${apiBase}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    let message = "Login failed";
  
    try {
      const errorData = await res.json();
      if (typeof errorData?.error === "string") {
        message = errorData.error;
      }
    } catch {}
  
    const response = NextResponse.redirect(
      new URL("/login", req.url)
    );
  
    // 🔴 FLASH COOKIE (short-lived)
    response.cookies.set("login_error", message, {
      path: "/",
      httpOnly: true,
      maxAge: 10, // seconds
    });
  
    return response;
  }
  
  const data = await res.json();

  // 3️⃣ SUCCESS → SET COOKIES + REDIRECT
  const response = NextResponse.redirect(
    new URL("/dashboard", req.url)
  );

  response.cookies.set("auth_token", data.token, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: false, // true in production
  });

  response.cookies.set("user_role", data.user.role, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: false,
  });

  if (data.user.operator_id) {
    response.cookies.set("operator_id", data.user.operator_id, {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: false,
    });
  }

  return response;
}
