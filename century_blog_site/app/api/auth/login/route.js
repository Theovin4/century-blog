import { NextResponse } from "next/server";
import { createAdminSessionToken, validateAdminCredentials } from "@/lib/auth";
import { applyRateLimit, getRequestIp } from "@/lib/rate-limit";

export async function POST(request) {
  const ip = getRequestIp(request);
  const rateLimit = applyRateLimit({
    bucket: "admin-login",
    key: ip,
    limit: 8,
    windowMs: 10 * 60 * 1000
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { message: "Too many login attempts. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil(rateLimit.retryAfterMs / 1000))
        }
      }
    );
  }

  const body = await request.json().catch(() => ({}));
  const username = body?.username?.trim();
  const password = body?.password?.trim();

  if (!validateAdminCredentials(username, password)) {
    return NextResponse.json({ message: "Invalid admin credentials." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });

  response.cookies.set({
    name: "century_admin_session",
    value: createAdminSessionToken(username),
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
    priority: "high"
  });

  return response;
}
