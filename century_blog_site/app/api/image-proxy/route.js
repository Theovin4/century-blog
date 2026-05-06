import { NextResponse } from "next/server";

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

function isSafeImageUrl(value) {
  try {
    const target = new URL(String(value || ""));
    return ALLOWED_PROTOCOLS.has(target.protocol);
  } catch {
    return false;
  }
}

export async function GET(request) {
  const target = request.nextUrl.searchParams.get("url") || "";

  if (!isSafeImageUrl(target)) {
    return NextResponse.json({ message: "Invalid image URL." }, { status: 400 });
  }

  try {
    const upstream = await fetch(target, {
      headers: {
        "User-Agent": "CenturyBlogImageProxy/1.0"
      },
      cache: "no-store"
    });

    if (!upstream.ok) {
      return NextResponse.json({ message: "Unable to fetch image." }, { status: upstream.status });
    }

    const contentType = upstream.headers.get("content-type") || "";

    if (!contentType.startsWith("image/")) {
      return NextResponse.json({ message: "URL did not return an image." }, { status: 415 });
    }

    const body = await upstream.arrayBuffer();

    return new NextResponse(body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800"
      }
    });
  } catch {
    return NextResponse.json({ message: "Image proxy failed." }, { status: 502 });
  }
}
