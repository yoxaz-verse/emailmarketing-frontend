import { NextResponse } from "next/server";
import { serverFetch } from "@/lib/server/server-fetch";

export async function POST() {
  try {
    // Just call backend. serverFetch handles auth + redirects.
    await serverFetch("/lead", {
      method: "POST",
    });

    return NextResponse.json({
      success: true,
      message: "Email validation triggered",
    });
  } catch (err: any) {
    console.error("RUN VALIDATION ERROR:", err);

    return NextResponse.json(
      { error: err.message || "Failed to trigger validation" },
      { status: 500 }
    );
  }
}
