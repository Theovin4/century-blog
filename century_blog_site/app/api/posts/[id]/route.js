import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { deletePost, getPostById, updatePost } from "@/lib/posts-store";
import {
  getPersistentStorageErrorMessage,
  isCloudinaryConfigured,
  isPersistentStorageReady
} from "@/lib/cloudinary";
import { inferMediaType, isValidCategory } from "@/lib/site";
import { addNotification } from "@/lib/notifications-store";
import {
  canEditPost,
  getCurrentUser,
  hasPermission,
  logActivity
} from "@/lib/editorial";
import { deleteMatchingAutoDrafts } from "@/lib/auto-drafts-store";

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

function revalidatePostSurfaces(post, previousCategory = "") {
  revalidatePath("/");
  revalidatePath("/dashboard");
  revalidatePath("/sitemap.xml");
  revalidatePath(`/news/${post.slug}`);
  revalidatePath(`/category/${post.category}`);

  if (previousCategory && previousCategory !== post.category) {
    revalidatePath(`/category/${previousCategory}`);
  }
}

async function requireAdmin() {
  return getCurrentUser();
}

async function getPostByIdWithRetry(id, attempts = 4, delayMs = 450) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const post = await getPostById(id);

    if (post) {
      return post;
    }

    if (attempt < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return null;
}

export async function PATCH(request, { params }) {
  const user = await requireAdmin();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  if (!isPersistentStorageReady()) {
    return NextResponse.json({ message: getPersistentStorageErrorMessage() }, { status: 503 });
  }

  const { id } = await params;
  const current = await getPostByIdWithRetry(id);

  if (!current) {
    return NextResponse.json({ message: "Post not found." }, { status: 404 });
  }

  if (!canEditPost(user, current) && !hasPermission(user, "articles:review") && !hasPermission(user, "articles:feature")) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const title = String(formData.get("title") || current.title).trim();
  const excerpt = String(formData.get("excerpt") || current.excerpt).trim();
  const content = String(formData.get("content") || current.content).trim();
  const category = String(formData.get("category") || current.category).trim();
  const author = String(formData.get("author") || current.author).trim();
  const seoTitle = String(formData.get("seoTitle") || current.seoTitle || "").trim();
  const metaDescription = String(formData.get("metaDescription") || current.metaDescription || "").trim();
  const tags = String(formData.get("tags") || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const imageAlt = String(formData.get("imageAlt") || current.imageAlt || "").trim();
  const sourceName = String(formData.get("sourceName") || current.sourceName || "").trim();
  const sourceUrl = String(formData.get("sourceUrl") || current.sourceUrl || "").trim();
  const sourceCountry = String(formData.get("sourceCountry") || current.sourceCountry || "").trim();
  const sourceLinks = String(formData.get("sourceLinks") || "")
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
  const requestedWorkflowStatus = String(formData.get("workflowStatus") || current.workflowStatus || "").trim();
  const autoDraftId = String(formData.get("autoDraftId") || "").trim();
  const reviewNotes = String(formData.get("reviewNotes") || current.reviewNotes || "").trim();
  const scheduledFor = String(formData.get("scheduledFor") || current.scheduledFor || "").trim();
  const featuredValue = formData.get("featured");
  const featured = featuredValue === null ? undefined : String(featuredValue).trim() === "true";
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

  let workflowStatus = workflowStatusOptions.includes(requestedWorkflowStatus)
    ? requestedWorkflowStatus
    : current.workflowStatus || "published";

  if ((workflowStatus === "published" || workflowStatus === "approved") && !hasPermission(user, "articles:publish")) {
    workflowStatus = "pending_review";
  }

  if (featured === true && !hasPermission(user, "articles:feature")) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

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
    const post = await updatePost(
      id,
      {
        title,
        excerpt,
        content,
        category,
        author,
        featured,
        seoTitle,
        metaDescription,
        imageAlt,
        sourceName,
        sourceUrl,
        sourceCountry,
        sourceLinks,
        tags,
        workflowStatus,
        reviewNotes,
        scheduledFor,
        submittedAt:
          workflowStatus === "pending_review" && current.workflowStatus !== "pending_review"
            ? new Date().toISOString()
            : current.submittedAt,
        submittedBy:
          workflowStatus === "pending_review" && current.workflowStatus !== "pending_review"
            ? user.id
            : current.submittedBy,
        approvedAt:
          workflowStatus === "published" || workflowStatus === "approved"
            ? new Date().toISOString()
            : current.approvedAt,
        approvedBy:
          workflowStatus === "published" || workflowStatus === "approved"
            ? user.id
            : current.approvedBy,
        rejectedAt: workflowStatus === "rejected" ? new Date().toISOString() : current.rejectedAt,
        rejectedBy: workflowStatus === "rejected" ? user.id : current.rejectedBy,
        lastEditedBy: user.id,
        lastEditedByName: user.name || user.username
      },
      media && typeof media !== "string" && media.size > 0 ? media : null
    );

    if (post.workflowStatus === "published" || current.workflowStatus === "published") {
      if (post.workflowStatus === "published") {
        await deleteMatchingAutoDrafts({
          id: autoDraftId,
          sourceUrl: post.sourceUrl,
          autoSourceId: post.autoSourceId,
          title: post.title
        }).catch(() => 0);
      }
      revalidatePostSurfaces(post, current.category);
    } else {
      revalidatePath("/dashboard");
    }

    if (workflowStatus === "pending_review" && current.workflowStatus !== "pending_review") {
      await addNotification({
        type: "info",
        title: "Article submitted for review",
        message: `${post.title} is waiting for editorial approval.`,
        targetRole: "admin"
      });
    }

    if (workflowStatus === "published" && current.workflowStatus !== "published") {
      await addNotification({
        type: "success",
        title: "Article approved",
        message: `${post.title} has been approved and published.`,
        targetUserId: post.createdBy || ""
      });
    }

    if (workflowStatus === "rejected") {
      await addNotification({
        type: "warning",
        title: "Article rejected",
        message: `${post.title} was returned for changes.`,
        targetUserId: post.createdBy || ""
      });
    }

    await logActivity(request, user, {
      action:
        workflowStatus === "published"
          ? "article.published"
          : workflowStatus === "rejected"
            ? "article.rejected"
            : workflowStatus === "pending_review"
              ? "article.submitted"
              : featured === true && !current.featured
                ? "article.featured"
                : "article.updated",
      entityType: "post",
      entityId: post.id,
      status: "success",
      details: {
        title: post.title,
        workflowStatus,
        previousWorkflowStatus: current.workflowStatus,
        category: post.category
      }
    });
    return NextResponse.json(post);
  } catch (error) {
    return NextResponse.json({ message: error.message || "Unable to update post." }, { status: 500 });
  }
}

export async function DELETE(_request, { params }) {
  const user = await requireAdmin();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  if (!hasPermission(user, "articles:delete")) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  if (!isPersistentStorageReady()) {
    return NextResponse.json({ message: getPersistentStorageErrorMessage() }, { status: 503 });
  }

  const { id } = await params;
  const current = await getPostByIdWithRetry(id);
  const deleted = await deletePost(id);

  if (!deleted || !current) {
    return NextResponse.json({ message: "Post not found." }, { status: 404 });
  }

  revalidatePath("/");
  revalidatePath("/dashboard");
  revalidatePath("/sitemap.xml");
  revalidatePath(`/news/${current.slug}`);
  revalidatePath(`/category/${current.category}`);

  await logActivity(_request, user, {
    action: "article.deleted",
    entityType: "post",
    entityId: current.id,
    status: "success",
    details: {
      title: current.title,
      category: current.category
    }
  });

  return NextResponse.json({ ok: true });
}




