import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { createPost, getAllPosts, getPosts } from "@/lib/posts-store";
import {
  getPersistentStorageErrorMessage,
  isCloudinaryConfigured,
  isPersistentStorageReady
} from "@/lib/cloudinary";
import { inferMediaType, isValidCategory } from "@/lib/site";
import {
  getCurrentUser,
  hasPermission,
  logActivity
} from "@/lib/editorial";
import { addNotification } from "@/lib/notifications-store";

const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
const MAX_VIDEO_SIZE = 20 * 1024 * 1024;
const workflowStatusOptions = ["draft", "pending_review", "approved", "published", "rejected", "scheduled"];

function validateMedia(media) {
  const mediaType = media.type || inferMediaType(media.name);
  const isImage = mediaType.startsWith("image/");
  const isVideo = mediaType.startsWith("video/");

  if (!isImage && !isVideo) {
    return "Only image and video uploads are supported.";
  }

  if (isImage && media.size > MAX_IMAGE_SIZE) {
    return "Images must be 8MB or smaller.";
  }

  if (isVideo && media.size > MAX_VIDEO_SIZE) {
    return "Videos must be 20MB or smaller.";
  }

  return "";
}

function revalidatePostSurfaces(post) {
  revalidatePath("/");
  revalidatePath("/dashboard");
  revalidatePath("/sitemap.xml");
  revalidatePath("/blog");

  if (post?.category) {
    revalidatePath(`/category/${post.category}`);
  }

  if (post?.slug) {
    revalidatePath(`/news/${post.slug}`);
  }
}

function parseCsv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseSourceLinks(value) {
  const normalized = String(value || "").trim();

  if (!normalized) {
    return [];
  }

  return normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [labelPart, urlPart] = line.includes("|") ? line.split("|") : ["", line];
      return {
        label: String(labelPart || urlPart).trim(),
        url: String(urlPart || "").trim()
      };
    })
    .filter((item) => /^https?:\/\//i.test(item.url));
}

function normalizeWorkflowStatus(status, fallback = "draft") {
  const normalized = String(status || "").trim();
  return workflowStatusOptions.includes(normalized) ? normalized : fallback;
}

function resolveWorkflowStatus(user, requestedStatus, scheduledFor = "") {
  const requested = normalizeWorkflowStatus(requestedStatus, hasPermission(user, "articles:publish") ? "published" : "draft");

  if (requested === "scheduled") {
    return scheduledFor ? "scheduled" : hasPermission(user, "articles:publish") ? "published" : "pending_review";
  }

  if (requested === "published" || requested === "approved") {
    return hasPermission(user, "articles:publish") ? requested : "pending_review";
  }

  return requested;
}

export async function GET() {
  const user = await getCurrentUser();
  const posts = user ? await getAllPosts() : await getPosts();
  return NextResponse.json(posts);
}

export async function POST(request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  if (!hasPermission(user, "articles:create")) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  if (!isPersistentStorageReady()) {
    return NextResponse.json({ message: getPersistentStorageErrorMessage() }, { status: 503 });
  }

  const formData = await request.formData();
  const title = String(formData.get("title") || "").trim();
  const excerpt = String(formData.get("excerpt") || "").trim();
  const content = String(formData.get("content") || "").trim();
  const category = String(formData.get("category") || "").trim();
  const author = String(formData.get("author") || "").trim();
  const seoTitle = String(formData.get("seoTitle") || "").trim();
  const metaDescription = String(formData.get("metaDescription") || "").trim();
  const imageAlt = String(formData.get("imageAlt") || "").trim();
  const sourceName = String(formData.get("sourceName") || "").trim();
  const sourceUrl = String(formData.get("sourceUrl") || "").trim();
  const sourceCountry = String(formData.get("sourceCountry") || "").trim();
  const sourceLinks = parseSourceLinks(formData.get("sourceLinks"));
  const tags = parseCsv(formData.get("tags"));
  const scheduledFor = String(formData.get("scheduledFor") || "").trim();
  const requestedWorkflowStatus = String(formData.get("workflowStatus") || "").trim();
  const media = formData.get("media");

  if (!title || !excerpt || !content || !category) {
    return NextResponse.json(
      { message: "Title, excerpt, content, and category are required." },
      { status: 400 }
    );
  }

  if (title.length > 140 || excerpt.length > 280 || content.length > 20000) {
    return NextResponse.json({ message: "Post content is too long." }, { status: 400 });
  }

  if (!isValidCategory(category)) {
    return NextResponse.json({ message: "Choose a valid category." }, { status: 400 });
  }

  const workflowStatus = resolveWorkflowStatus(user, requestedWorkflowStatus, scheduledFor);
  if (media && typeof media !== "string" && media.size > 0) {
    if (!isCloudinaryConfigured()) {
      return NextResponse.json({ message: getPersistentStorageErrorMessage() }, { status: 503 });
    }

    const mediaError = validateMedia(media);
    if (mediaError) {
      return NextResponse.json({ message: mediaError }, { status: 400 });
    }
  }

  try {
    const post = await createPost(
      {
        title,
        excerpt,
        content,
        category,
        author,
        seoTitle,
        metaDescription,
        imageAlt,
        sourceName,
        sourceUrl,
        sourceCountry,
        sourceLinks,
        tags,
        scheduledFor,
        workflowStatus,
        createdBy: user.id,
        createdByName: user.name || user.username,
        lastEditedBy: user.id,
        lastEditedByName: user.name || user.username,
        submittedAt: workflowStatus === "pending_review" ? new Date().toISOString() : "",
        submittedBy: workflowStatus === "pending_review" ? user.id : "",
        approvedAt: workflowStatus === "published" || workflowStatus === "approved" ? new Date().toISOString() : "",
        approvedBy: workflowStatus === "published" || workflowStatus === "approved" ? user.id : ""
      },
      media && typeof media !== "string" && media.size > 0 ? media : null
    );

    if (post.workflowStatus === "published") {
      revalidatePostSurfaces(post);
    } else {
      revalidatePath("/dashboard");
    }

    const action =
      post.workflowStatus === "pending_review"
        ? "article.submitted"
        : post.workflowStatus === "draft"
          ? "article.drafted"
          : "article.published";

    await logActivity(request, user, {
      action,
      entityType: "post",
      entityId: post.id,
      status: "success",
      details: {
        title: post.title,
        workflowStatus: post.workflowStatus,
        category: post.category
      }
    });

    if (post.workflowStatus === "pending_review") {
      await addNotification({
        type: "info",
        title: "Article submitted for review",
        message: `${post.title} is waiting for editorial approval.`,
        targetRole: "admin"
      });
    }

    return NextResponse.json(post, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: error.message || "Unable to create post." }, { status: 500 });
  }
}




