import { NextResponse } from "next/server";
import { getAllPosts } from "@/lib/posts-store";
import { getCurrentUser, hasPermission, logActivity } from "@/lib/editorial";
import { addNotification } from "@/lib/notifications-store";
import { requireTrustedWriteOrigin } from "@/lib/request-security";
import { createUser, getAllUsers, sanitizeUserForClient } from "@/lib/users-store";

function buildUserStats(user, posts) {
  const ownedPosts = posts.filter((post) => String(post.createdBy || "") === String(user.id));

  return {
    postsCreated: ownedPosts.length,
    postsApproved: ownedPosts.filter((post) => ["approved", "published"].includes(post.workflowStatus || "")).length,
    postsRejected: ownedPosts.filter((post) => String(post.workflowStatus || "") === "rejected").length
  };
}

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  if (!hasPermission(user, "moderators:manage")) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const [users, posts] = await Promise.all([getAllUsers(), getAllPosts()]);

  return NextResponse.json(
    users.map((account) => ({
      ...sanitizeUserForClient(account),
      ...buildUserStats(account, posts)
    }))
  );
}

export async function POST(request) {
  const originError = requireTrustedWriteOrigin(request);
  if (originError) {
    return originError;
  }

  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  if (!hasPermission(user, "moderators:manage")) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));

  try {
    if (body.role === "super_admin") {
      return NextResponse.json({ message: "Create additional admins or moderators here, not another super admin." }, { status: 400 });
    }

    const createdUser = await createUser(body);

    await addNotification({
      type: "success",
      title: "Moderator account created",
      message: `${createdUser.name || createdUser.username} can now access the editorial dashboard.`,
      targetRole: "super_admin"
    });

    await logActivity(request, user, {
      action: "user.created",
      entityType: "user",
      entityId: createdUser.id,
      status: "success",
      details: {
        role: createdUser.role,
        username: createdUser.username
      }
    });

    return NextResponse.json(sanitizeUserForClient(createdUser), { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: error.message || "Unable to create user." }, { status: 400 });
  }
}
