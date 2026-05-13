import { NextResponse } from "next/server";
import { getActivityLogs } from "@/lib/activity-log-store";
import { getCurrentUser, hasPermission } from "@/lib/editorial";
import { getAllPosts } from "@/lib/posts-store";
import { getAllUsers } from "@/lib/users-store";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const [posts, users, logs] = await Promise.all([
    getAllPosts(),
    hasPermission(user, "moderators:manage") ? getAllUsers() : Promise.resolve([]),
    hasPermission(user, "analytics:view") ? getActivityLogs() : Promise.resolve([])
  ]);

  const visiblePosts = hasPermission(user, "articles:edit:any")
    ? posts
    : posts.filter((post) => String(post.createdBy || "") === String(user.id));

  const pendingReviewCount = posts.filter((post) => String(post.workflowStatus || "") === "pending_review").length;
  const publishedCount = posts.filter((post) => String(post.workflowStatus || "published") === "published").length;
  const draftCount = visiblePosts.filter((post) => String(post.workflowStatus || "") === "draft").length;
  const recentActivity = logs.slice(0, 12);

  const moderatorPerformance = users
    .filter((account) => ["moderator", "editor", "admin"].includes(account.role))
    .map((account) => {
      const ownedPosts = posts.filter((post) => String(post.createdBy || "") === String(account.id));

      return {
        id: account.id,
        name: account.name || account.username,
        role: account.role,
        status: account.status,
        postsCreated: ownedPosts.length,
        approvedCount: ownedPosts.filter((post) => ["approved", "published"].includes(post.workflowStatus || "")).length,
        rejectedCount: ownedPosts.filter((post) => String(post.workflowStatus || "") === "rejected").length
      };
    });

  return NextResponse.json({
    pendingReviewCount,
    publishedCount,
    draftCount,
    recentActivity,
    moderatorPerformance
  });
}
