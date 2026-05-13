import { NextResponse } from "next/server";
import { getCurrentUser, hasPermission, logActivity } from "@/lib/editorial";
import { addNotification } from "@/lib/notifications-store";
import { getUserById, resetUserPassword, sanitizeUserForClient, updateUser } from "@/lib/users-store";

export async function PATCH(request, { params }) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  if (!hasPermission(user, "moderators:manage")) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  if (String(id) === "env-super-admin") {
    return NextResponse.json({ message: "The env super admin cannot be modified here." }, { status: 400 });
  }

  const current = await getUserById(id);

  if (!current) {
    return NextResponse.json({ message: "User not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));

  if (body.role === "super_admin") {
    return NextResponse.json({ message: "The super admin role is reserved for the protected primary account." }, { status: 400 });
  }

  const patch = {};

  if (body.name !== undefined) patch.name = String(body.name || "").trim();
  if (body.email !== undefined) patch.email = String(body.email || "").trim().toLowerCase();
  if (body.username !== undefined) patch.username = String(body.username || "").trim().toLowerCase();
  if (body.role !== undefined) patch.role = body.role;
  if (body.status !== undefined) patch.status = body.status;

  try {
    const updatedUser = await updateUser(id, patch);

    if (!updatedUser) {
      return NextResponse.json({ message: "User not found." }, { status: 404 });
    }

    if (body.resetPassword) {
      await resetUserPassword(id, String(body.resetPassword));
    }

    if (patch.status === "suspended") {
      await addNotification({
        type: "warning",
        title: "Moderator suspended",
        message: `${updatedUser.name || updatedUser.username} has been suspended.`,
        targetRole: "super_admin"
      });
    }

    await logActivity(request, user, {
      action: body.resetPassword ? "user.password_reset" : "user.updated",
      entityType: "user",
      entityId: updatedUser.id,
      status: "success",
      details: {
        role: updatedUser.role,
        status: updatedUser.status,
        username: updatedUser.username
      }
    });

    return NextResponse.json(sanitizeUserForClient(updatedUser));
  } catch (error) {
    return NextResponse.json({ message: error.message || "Unable to update user." }, { status: 400 });
  }
}
