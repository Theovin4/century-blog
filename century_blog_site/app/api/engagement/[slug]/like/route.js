import { NextResponse } from "next/server";
import { addLikeToPost } from "@/lib/engagement-store";
import { getPostBySlug } from "@/lib/posts-store";

export async function POST(request, { params }) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post) {
    return NextResponse.json({ message: "Post not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const visitorId = String(body?.visitorId || "").trim();

  if (!visitorId || visitorId.length > 200) {
    return NextResponse.json({ message: "A valid visitor id is required." }, { status: 400 });
  }

  const result = await addLikeToPost(slug, visitorId);
  return NextResponse.json(result, { status: result.liked ? 201 : 200 });
}
