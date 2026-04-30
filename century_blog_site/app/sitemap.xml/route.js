import { NextResponse } from "next/server";
import { getPosts } from "@/lib/posts-store";
import { getActiveCategories, getSiteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

function escapeXml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function renderUrlEntry({ url, lastModified, changeFrequency, priority }) {
  return [
    "  <url>",
    `    <loc>${escapeXml(url)}</loc>`,
    lastModified ? `    <lastmod>${escapeXml(new Date(lastModified).toISOString())}</lastmod>` : "",
    changeFrequency ? `    <changefreq>${escapeXml(changeFrequency)}</changefreq>` : "",
    typeof priority === "number" ? `    <priority>${priority}</priority>` : "",
    "  </url>"
  ]
    .filter(Boolean)
    .join("\n");
}

export async function GET() {
  const siteUrl = getSiteUrl();
  const now = new Date().toISOString();
  const posts = await getPosts();
  const activeCategories = getActiveCategories(posts);

  const urls = [
    {
      url: siteUrl,
      lastModified: now,
      changeFrequency: "hourly",
      priority: 1
    },
    {
      url: `${siteUrl}/about`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6
    },
    {
      url: `${siteUrl}/contact`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6
    },
    {
      url: `${siteUrl}/privacy-policy`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5
    },
    {
      url: `${siteUrl}/terms-and-conditions`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5
    },
    {
      url: `${siteUrl}/cookies-policy`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5
    },
    ...activeCategories.map((category) => ({
      url: `${siteUrl}/category/${category}`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8
    })),
    ...posts.map((post) => ({
      url: `${siteUrl}/news/${post.slug}`,
      lastModified: post.updatedAt || post.publishedAt,
      changeFrequency: "daily",
      priority: 0.9
    }))
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map(renderUrlEntry)
    .join("\n")}\n</urlset>`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}
