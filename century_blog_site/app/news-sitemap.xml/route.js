import { NextResponse } from "next/server";
import { getPosts } from "@/lib/posts-store";
import { getSiteUrl } from "@/lib/site";

function escapeXml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export const dynamic = "force-dynamic";

export async function GET() {
  const siteUrl = getSiteUrl();
  const cutoff = Date.now() - (2 * 24 * 60 * 60 * 1000);
  const posts = (await getPosts())
    .filter((post) => post?.slug)
    .filter((post) => new Date(post.sitePublishedAt || post.publishedAt || post.updatedAt).getTime() >= cutoff)
    .slice(0, 1000);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">\n${posts
    .map((post) => `  <url>\n    <loc>${escapeXml(`${siteUrl}/news/${post.slug}`)}</loc>\n    <news:news>\n      <news:publication>\n        <news:name>${escapeXml("Century Blog")}</news:name>\n        <news:language>en</news:language>\n      </news:publication>\n      <news:publication_date>${escapeXml(new Date(post.sitePublishedAt || post.publishedAt || post.updatedAt).toISOString())}</news:publication_date>\n      <news:title>${escapeXml(post.title)}</news:title>\n    </news:news>\n  </url>`)
    .join("\n")}\n</urlset>`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
      "X-Robots-Tag": "noindex, follow"
    }
  });
}
