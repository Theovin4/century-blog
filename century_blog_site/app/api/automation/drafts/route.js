import { NextResponse } from "next/server";
import { getAutoDrafts } from "@/lib/auto-drafts-store";
import { getPosts } from "@/lib/posts-store";
import { getCurrentUser, hasPermission } from "@/lib/editorial";

async function requireAdmin() {
  return getCurrentUser();
}

export async function GET() {
  const user = await requireAdmin();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  if (!hasPermission(user, "articles:review")) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const [drafts, publishedPosts] = await Promise.all([
    getAutoDrafts(),
    getPosts().catch(() => [])
  ]);

  const publishedSourceUrls = new Set(
    publishedPosts
      .map((post) => String(post.sourceUrl || "").trim().toLowerCase())
      .filter(Boolean)
  );
  const publishedAutoSourceIds = new Set(
    publishedPosts
      .map((post) => String(post.autoSourceId || "").trim().toLowerCase())
      .filter(Boolean)
  );
  const publishedTitles = new Set(
    publishedPosts
      .map((post) => String(post.title || "").trim().toLowerCase())
      .filter(Boolean)
  );

  const visibleDrafts = drafts.filter((draft) => {
    const sourceUrl = String(draft.sourceUrl || "").trim().toLowerCase();
    const autoSourceId = String(draft.autoSourceId || "").trim().toLowerCase();
    const title = String(draft.title || "").trim().toLowerCase();

    if (sourceUrl && publishedSourceUrls.has(sourceUrl)) {
      return false;
    }

    if (autoSourceId && publishedAutoSourceIds.has(autoSourceId)) {
      return false;
    }

    if (title && publishedTitles.has(title)) {
      return false;
    }

    return true;
  });

  return NextResponse.json(visibleDrafts);
}
