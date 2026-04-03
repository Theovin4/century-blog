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

  const body = await request.json();

  if (!body?.title || !body?.excerpt || !body?.content || !body?.category) {
    return NextResponse.json(
      { message: "Title, excerpt, content, and category are required." },
      { status: 400 }
    );
  }

  const post = await createPost(body);

  return NextResponse.json(post, { status: 201 });
}
