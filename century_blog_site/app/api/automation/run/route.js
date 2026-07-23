import { NextResponse } from "next/server";
import { runAutomatedNewsIngestionSafely } from "@/lib/auto-news";
import { markAutomationFailure } from "@/lib/automation-store";
import { getPersistentStorageErrorMessage, isPersistentStorageReady } from "@/lib/cloudinary";
import { getCurrentUser, hasPermission } from "@/lib/editorial";
import { ensurePostsBackup, publishDueScheduledPosts } from "@/lib/posts-store";
import { requireTrustedWriteOrigin } from "@/lib/request-security";

async function isAllowedByAdmin() {
  const user = await getCurrentUser();
  return user && hasPermission(user, "articles:settings");
}

function isAllowedBySecret(request) {
  const secret = process.env.CRON_SECRET || process.env.AUTO_NEWS_CRON_SECRET || "";

  if (!secret) {
    return false;
  }

  return request.headers.get("x-cron-secret") === secret || request.headers.get("authorization") === `Bearer ${secret}`;
}

async function handleRun(request, force = false) {
  const isAdmin = await isAllowedByAdmin();
  const isSecretAllowed = isAllowedBySecret(request);

  if (!isAdmin && !isSecretAllowed) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  if (!isSecretAllowed) {
    const originError = requireTrustedWriteOrigin(request);
    if (originError) {
      return originError;
    }
  }

  if (!isPersistentStorageReady()) {
    return NextResponse.json({ message: getPersistentStorageErrorMessage() }, { status: 503 });
  }

  try {
    console.info("[automation] run requested", {
      force,
      isAdmin,
      isSecretAllowed
    });
    const backup = await ensurePostsBackup({ maxAgeHours: 24 });
    const scheduledPublishedCount = await publishDueScheduledPosts();
    const result = await runAutomatedNewsIngestionSafely({ force: force || isAdmin });
    console.info("[automation] run completed", {
      status: result?.status || "idle",
      publishedCount: Number(result?.publishedCount || 0),
      scheduledPublishedCount
    });
    return NextResponse.json({
      ...result,
      backup,
      scheduledPublishedCount
    });
  } catch (error) {
    console.error("[automation] route failed", {
      message: error?.message || "Automation run failed."
    });
    await markAutomationFailure(error, "Automation run failed before publishing.").catch(() => undefined);
    return NextResponse.json({ message: error.message || "Automation run failed." }, { status: 500 });
  }
}

export async function POST(request) {
  return handleRun(request, true);
}

export async function GET(request) {
  return handleRun(request, false);
}
