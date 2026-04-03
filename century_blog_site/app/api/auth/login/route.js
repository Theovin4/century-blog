import { NextResponse } from "next/server";
import { createAdminSessionToken, validateAdminCredentials } from "@/lib/auth";

export async function POST(request) {
  const body = await request.json();
  const username = body?.username?.trim();
  const password = body?.password?.trim();

  if (!validateAdminCredentials(username, password)) {
    return NextResponse.json(
      { message: "Invalid admin credentials. Check your environment variables." },
      { status: 401 }
    );
  }

  const response = NextResponse.json({ ok: true });

  response.cookies.set({
    name: "century_admin_session",
    value: createAdminSessionToken(username),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7
  });

  return response;
}
