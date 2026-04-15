import { NextResponse } from "next/server";

export const dynamic = "force-static";

export function GET() {
  return new NextResponse("google.com, pub-1037358753872630, DIRECT, f08c47fec0942fa0\n", {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600"
    }
  });
}
