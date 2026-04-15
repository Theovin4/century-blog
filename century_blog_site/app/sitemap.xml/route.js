import { NextResponse } from "next/server";
import { getPosts } from "@/lib/posts-store";
import { categoryOptions, getSiteUrl } from "@/lib/site";

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
  const posts = await getPosts();
  const now = new Date().toISOString();
  const items = [
    { url: siteUrl, lastModified: now, changeFrequency: "hourly", priority: "1.0" },
    { url: `${siteUrl}/about`, lastModified: now, changeFrequency: "monthly", priority: "0.6" },
    { url: `${siteUrl}/contact`, lastModified: now, changeFrequency: "monthly", priority: "0.6" },
    { url: `${siteUrl}/privacy-policy`, lastModified: now, changeFrequency: "monthly", priority: "0.5" },
    ...categoryOptions.map((category) => ({
      url: `${siteUrl}/category/${category}`,
      lastModified: now,
      changeFrequency: "daily",
      priority: "0.8"
    })),
    ...posts.map((post) => ({
      url: `${siteUrl}/news/${post.slug}`,
      lastModified: new Date(post.updatedAt || post.publishedAt).toISOString(),
      changeFrequency: "daily",
      priority: "0.9"
    }))
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items
    .map(
      (item) => `  <url>\n    <loc>${escapeXml(item.url)}</loc>\n    <lastmod>${escapeXml(item.lastModified)}</lastmod>\n    <changefreq>${item.changeFrequency}</changefreq>\n    <priority>${item.priority}</priority>\n  </url>`
    )
    .join("\n")}\n</urlset>`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}
