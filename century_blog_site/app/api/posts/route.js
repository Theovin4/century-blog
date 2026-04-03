import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isAdminAuthenticated } from "@/lib/auth";
import { createPost, getPosts } from "@/lib/posts-store";

export async function GET() {
  const posts = await getPosts();
  return NextResponse.json(posts);
}

export async function POST(request) {
  const cookieStore = await cookies();
  const isAuthenticated = isAdminAuthenticated(cookieStore.get("century_admin_session")?.value);

  if (!isAuthenticated) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const title = String(formData.get("title") || "").trim();
  const excerpt = String(formData.get("excerpt") || "").trim();
  const content = String(formData.get("content") || "").trim();
  const category = String(formData.get("category") || "").trim();
  const author = String(formData.get("author") || "").trim();
  const media = formData.get("media");

  if (!title || !excerpt || !content || !category) {
    return NextResponse.json(
      { message: "Title, excerpt, content, and category are required." },
      { status: 400 }
    );
  }

  if (media && typeof media !== "string") {
    const isSupported = media.type.startsWith("image/") || media.type.startsWith("video/");
    if (media.size > 0 && !isSupported) {
      return NextResponse.json(
        { message: "Only image and video uploads are supported." },
        { status: 400 }
      );
    }
  }

  const post = await createPost(
    {
      title,
      excerpt,
      content,
      category,
      author
    },
    media && typeof media !== "string" && media.size > 0 ? media : null
  );

  return NextResponse.json(post, { status: 201 });
}
