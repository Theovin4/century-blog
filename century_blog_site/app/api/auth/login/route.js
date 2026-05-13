import { NextResponse } from "next/server";
import { addNotification } from "@/lib/notifications-store";
import { applyRateLimit, getRequestIp } from "@/lib/rate-limit";
import { authenticateUser, createSessionToken, logActivity } from "@/lib/editorial";

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

  const user = await authenticateUser(username, password);

  if (!user) {
    await addNotification({
      type: "warning",
      title: "Failed login attempt",
      message: `A login attempt failed for ${username || "unknown user"}.`,
      targetRole: "super_admin"
    });
    await logActivity(request, null, {
      action: "auth.login.failed",
      entityType: "session",
      entityId: username || "unknown",
      status: "warning",
      details: {
        username: username || "",
        reason: "Invalid credentials"
      }
    });
    return NextResponse.json({ message: "Invalid admin credentials." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true, user });

  response.cookies.set({
    name: "century_admin_session",
    value: createSessionToken(user),
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
    priority: "high"
  });

  await logActivity(request, user, {
    action: "auth.login",
    entityType: "session",
    entityId: user.id,
    status: "success",
    details: {
      username: user.username
    }
  });

  return response;
}
