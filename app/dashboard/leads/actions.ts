"use server";

import { cookies } from "next/headers";

export async function runEmailValidationAction() {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;

  if (!apiBase) {
    throw new Error("API base URL not configured");
  }

  // ✅ cookies() MUST be awaited in Server Actions
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  if (!token) {
    throw new Error("Unauthorized");
  }

  const res = await fetch(`${apiBase}/validate/lead`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Backend rejected request");
  }

  return { success: true };
}
