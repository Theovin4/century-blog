import { NextResponse } from "next/server";
import { runAutomatedNewsIngestion } from "@/lib/auto-news";
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
    const backup = await ensurePostsBackup({ maxAgeHours: 24 });
    const scheduledPublishedCount = await publishDueScheduledPosts();
    const result = await runAutomatedNewsIngestion({ force: force || isAdmin });
    return NextResponse.json({
      ...result,
      backup,
      scheduledPublishedCount
    });
  } catch (error) {
    return NextResponse.json({ message: error.message || "Automation run failed." }, { status: 500 });
  }
}

export async function POST(request) {
  return handleRun(request, true);
}

export async function GET(request) {
  return handleRun(request, false);
}
