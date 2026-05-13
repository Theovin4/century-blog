import { NextResponse } from "next/server";
import { getCurrentUser, logActivity } from "@/lib/editorial";

export async function POST(request) {
  const user = await getCurrentUser();
  const response = NextResponse.json({ ok: true });

  response.cookies.set({
    name: "century_admin_session",
    value: "",
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
    priority: "high"
  });

  if (user) {
    await logActivity(request, user, {
      action: "auth.logout",
      entityType: "session",
      entityId: user.id,
      status: "success"
    });
  }

  return response;
}
