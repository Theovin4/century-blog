import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isAdminAuthenticated } from "@/lib/auth";
import { deletePost, getPostById, updatePost } from "@/lib/posts-store";
import { inferMediaType } from "@/lib/site";

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
  const media = formData.get("media");

  if (!title || !excerpt || !content || !category) {
    return NextResponse.json(
      { message: "Title, excerpt, content, and category are required." },
      { status: 400 }
    );
  }

  if (media && typeof media !== "string") {
    const mediaType = media.type || inferMediaType(media.name);
    const isSupported = mediaType.startsWith("image/") || mediaType.startsWith("video/");
    if (media.size > 0 && !isSupported) {
      return NextResponse.json(
        { message: "Only image and video uploads are supported." },
        { status: 400 }
      );
    }
  }

  const post = await updatePost(
    id,
    { title, excerpt, content, category, author },
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
