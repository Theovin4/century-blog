import { NextResponse } from "next/server";
import { getActivityLogs } from "@/lib/activity-log-store";
import { getAutomationProviderSummary } from "@/lib/auto-news";
import { getAutomationSettings } from "@/lib/automation-store";
import { getCurrentUser, hasPermission } from "@/lib/editorial";
import { getAllPosts, getPostsBackupStatus } from "@/lib/posts-store";
import { getAllUsers } from "@/lib/users-store";

function toTimestamp(value) {
  const timestamp = new Date(value || "").getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const [posts, users, logs, backupStatus, automationSettings, automationProviders] = await Promise.all([
    getAllPosts(),
    hasPermission(user, "moderators:manage") ? getAllUsers() : Promise.resolve([]),
    hasPermission(user, "analytics:view") ? getActivityLogs() : Promise.resolve([]),
    getPostsBackupStatus().catch(() => ({
      latestBackupAt: "",
      latestBackupUrl: "",
      latestBackupBytes: 0,
      latestBackupPublicId: ""
    })),
    getAutomationSettings(),
    Promise.resolve(getAutomationProviderSummary())
  ]);

  const visiblePosts = hasPermission(user, "articles:edit:any")
    ? posts
    : posts.filter((post) => String(post.createdBy || "") === String(user.id));

  const pendingReviewCount = posts.filter((post) => String(post.workflowStatus || "") === "pending_review").length;
  const publishedCount = posts.filter((post) => String(post.workflowStatus || "published") === "published").length;
  const draftCount = visiblePosts.filter((post) => String(post.workflowStatus || "") === "draft").length;
  const overdueScheduledCount = posts.filter((post) => {
    if (String(post.workflowStatus || "") !== "scheduled" || !post.scheduledFor) {
      return false;
    }

    return toTimestamp(post.scheduledFor) > 0 && toTimestamp(post.scheduledFor) <= Date.now();
  }).length;
  const latestPublishedAt = posts
    .filter((post) => String(post.workflowStatus || "published") === "published")
    .reduce((max, post) => Math.max(max, toTimestamp(post.sitePublishedAt || post.publishedAt || post.updatedAt)), 0);
  const warnings = [];

  if (latestPublishedAt && latestPublishedAt < Date.now() - (72 * 60 * 60 * 1000)) {
    warnings.push("Published feed looks stale. No new published post has surfaced in more than 72 hours.");
  }

  if (!automationProviders.cronSecretEnabled) {
    warnings.push("Automation cron secret is missing. Scheduled runs cannot authenticate until CRON_SECRET is configured in Vercel.");
  } else if (!automationSettings.lastRunAt) {
    warnings.push("Automation has not recorded a run yet. Trigger one manually or confirm the Vercel cron schedule is active.");
  } else if (automationSettings.lastRunStatus === "failed") {
    warnings.push(
      automationSettings.lastRunMessage
        ? `Latest automation run failed: ${automationSettings.lastRunMessage}`
        : "Latest automation run failed and needs attention."
    );
  } else if (toTimestamp(automationSettings.lastRunAt) < Date.now() - (18 * 60 * 60 * 1000)) {
    warnings.push("Automation run history looks stale. No run has been recorded in more than 18 hours.");
  }

  if (overdueScheduledCount > 0) {
    warnings.push(`${overdueScheduledCount} scheduled post${overdueScheduledCount === 1 ? "" : "s"} passed the publish time and should be checked.`);
  }

  if (!automationProviders.storageReady) {
    warnings.push("Persistent storage is not ready, so automated publishing cannot safely save posts.");
  }

  if (!backupStatus.latestBackupAt) {
    warnings.push("Posts backup snapshot has not been confirmed yet. Run automation or save a post to create a fresh remote backup.");
  } else if (toTimestamp(backupStatus.latestBackupAt) < Date.now() - (36 * 60 * 60 * 1000)) {
    warnings.push("Posts backup snapshot looks stale. Run automation or save a post to refresh the backup coverage.");
  }

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
    overdueScheduledCount,
    latestPublishedAt: latestPublishedAt ? new Date(latestPublishedAt).toISOString() : "",
    automationSettings,
    automationProviders,
    backupStatus,
    warnings,
    recentActivity,
    moderatorPerformance
  });
}
