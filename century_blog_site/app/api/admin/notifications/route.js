import { NextResponse } from "next/server";
import { getCurrentUser, getDashboardNotifications } from "@/lib/editorial";
import { markNotificationRead } from "@/lib/notifications-store";
import { requireTrustedWriteOrigin } from "@/lib/request-security";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(await getDashboardNotifications(user));
}

export async function PATCH(request) {
  const originError = requireTrustedWriteOrigin(request);
  if (originError) {
    return originError;
  }

  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const notification = await markNotificationRead(body.id, user.id);

  if (!notification) {
    return NextResponse.json({ message: "Notification not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
