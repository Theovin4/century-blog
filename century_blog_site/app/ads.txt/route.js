import { NextResponse } from "next/server";
import { ADS_TXT_ENTRY } from "@/lib/adsense";

export const dynamic = "force-static";

export function GET() {
  return new NextResponse(`${ADS_TXT_ENTRY}\n`, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600"
    }
  });
}
