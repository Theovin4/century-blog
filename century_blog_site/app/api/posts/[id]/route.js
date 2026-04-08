import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isAdminAuthenticated } from "@/lib/auth";
import { deletePost, getPostById, updatePost } from "@/lib/posts-store";
import { inferMediaType, isValidCategory } from "@/lib/site";

const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
const MAX_VIDEO_SIZE = 40 * 1024 * 1024;

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
    return "Videos must be 40MB or smaller.";
  }

  return "";
}

async function requireAdmin() {
  const cookieStore = await cookies();
  return isAdminAuthenticated(cookieStore.get("century_admin_session")?.value);
}

export async function PATCH(request, { params }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const current = await getPostById(id);

  if (!current) {
    return NextResponse.json({ message: "Post not found." }, { status: 404 });
  }

  const formData = await request.formData();
  const title = String(formData.get("title") || current.title).trim();
  const excerpt = String(formData.get("excerpt") || current.excerpt).trim();
  const content = String(formData.get("content") || current.content).trim();
  const category = String(formData.get("category") || current.category).trim();
  const author = String(formData.get("author") || current.author).trim();
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

  if (media && typeof media !== "string" && media.size > 0) {
    const mediaError = validateMedia(media);
    if (mediaError) {
      return NextResponse.json({ message: mediaError }, { status: 400 });
    }
  }

  const post = await updatePost(
    id,
    { title, excerpt, content, category, author, featured },
    media && typeof media !== "string" && media.size > 0 ? media : null
  );

  return NextResponse.json(post);
}

export async function DELETE(_request, { params }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const deleted = await deletePost(id);

  if (!deleted) {
    return NextResponse.json({ message: "Post not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
