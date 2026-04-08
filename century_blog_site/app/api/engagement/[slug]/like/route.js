import { NextResponse } from "next/server";
import { addLikeToPost } from "@/lib/engagement-store";
import { getPostBySlug } from "@/lib/posts-store";
import { applyRateLimit, getRequestIp } from "@/lib/rate-limit";

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

  const ip = getRequestIp(request);
  const rateLimit = applyRateLimit({
    bucket: "post-like",
    key: `${ip}:${slug}`,
    limit: 12,
    windowMs: 10 * 60 * 1000
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { message: "Too many like attempts in a short time. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil(rateLimit.retryAfterMs / 1000))
        }
      }
    );
  }

  const result = await addLikeToPost(slug, visitorId);
  return NextResponse.json(result, { status: result.liked ? 201 : 200 });
}
