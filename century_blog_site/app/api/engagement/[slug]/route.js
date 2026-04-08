import { NextResponse } from "next/server";
import { getEngagementBySlug } from "@/lib/engagement-store";
import { getPostBySlug } from "@/lib/posts-store";

export async function GET(_request, { params }) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post) {
    return NextResponse.json({ message: "Post not found." }, { status: 404 });
  }

  const engagement = await getEngagementBySlug(slug);
  return NextResponse.json(engagement);
}
