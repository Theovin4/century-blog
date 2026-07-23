import { NextResponse } from "next/server";
import { filterNewsSitemapPosts } from "@/lib/content-quality";
import { getPostSummaries } from "@/lib/posts-store";
import { getSiteUrl, normalizeStoredText } from "@/lib/site";

function escapeXml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export const revalidate = 900;

function toIsoDate(value) {
  const date = new Date(value || "");

  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }

  return date.toISOString();
}

function renderNewsUrl(siteUrl, post) {
  const publicationDate = toIsoDate(post.sitePublishedAt || post.publishedAt || post.updatedAt);
  const title = normalizeStoredText(post.title);

  return `<url><loc>${escapeXml(`${siteUrl}/news/${post.slug}`)}</loc><news:news><news:publication><news:name>Century Blog</news:name><news:language>en</news:language></news:publication><news:publication_date>${escapeXml(publicationDate)}</news:publication_date><news:title>${escapeXml(title)}</news:title></news:news></url>`;
}

export async function GET() {
  const siteUrl = getSiteUrl();
  const cutoff = Date.now() - (2 * 24 * 60 * 60 * 1000);
  const posts = filterNewsSitemapPosts(await getPostSummaries().catch(() => []))
    .filter((post) => post?.slug)
    .filter((post) => new Date(post.sitePublishedAt || post.publishedAt || post.updatedAt).getTime() >= cutoff)
    .slice(0, 1000);

  const xmlEntries = posts.map((post) => renderNewsUrl(siteUrl, post)).join("");
  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">${xmlEntries}</urlset>`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=900, stale-while-revalidate=86400",
      "X-Robots-Tag": "index, follow"
    }
  });
}
