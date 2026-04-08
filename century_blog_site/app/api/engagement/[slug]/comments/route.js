import { NextResponse } from "next/server";
import { addCommentToPost } from "@/lib/engagement-store";
import { getPostBySlug } from "@/lib/posts-store";
import { applyRateLimit, getRequestIp } from "@/lib/rate-limit";

const MAX_NAME_LENGTH = 40;
const MAX_MESSAGE_LENGTH = 600;

export async function POST(request, { params }) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post) {
    return NextResponse.json({ message: "Post not found." }, { status: 404 });
  }

  const ip = getRequestIp(request);
  const rateLimit = applyRateLimit({
    bucket: "post-comment",
    key: `${ip}:${slug}`,
    limit: 4,
    windowMs: 10 * 60 * 1000
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { message: "Too many comments in a short time. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil(rateLimit.retryAfterMs / 1000))
        }
      }
    );
  }

  const body = await request.json().catch(() => ({}));
  const name = String(body?.name || "").trim();
  const message = String(body?.message || "").trim();

  if (!name || !message) {
    return NextResponse.json({ message: "Name and comment are required." }, { status: 400 });
  }

  if (name.length > MAX_NAME_LENGTH || message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json({ message: "Comment is too long." }, { status: 400 });
  }

  const result = await addCommentToPost(slug, { name, message });
  return NextResponse.json(result, { status: 201 });
}
