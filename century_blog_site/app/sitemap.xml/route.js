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

function toIsoDate(value) {
  const date = new Date(value || "");

  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }

  return date.toISOString();
}

function renderUrl({ url, lastModified, changeFrequency, priority }) {
  return [
    "  <url>",
    `    <loc>${escapeXml(url)}</loc>`,
    `    <lastmod>${escapeXml(toIsoDate(lastModified))}</lastmod>`,
    changeFrequency ? `    <changefreq>${escapeXml(changeFrequency)}</changefreq>` : "",
    typeof priority === "number" ? `    <priority>${priority.toFixed(1)}</priority>` : "",
    "  </url>"
  ]
    .filter(Boolean)
    .join("\n");
}

export async function GET() {
  const siteUrl = getSiteUrl();
  const posts = await getPosts();
  const activeCategories = getActiveCategories(posts);
  const generatedAt = new Date().toISOString();

  const staticPages = [
    { url: `${siteUrl}/`, lastModified: generatedAt, changeFrequency: "daily", priority: 1.0 },
    { url: `${siteUrl}/blog`, lastModified: generatedAt, changeFrequency: "daily", priority: 0.9 },
    { url: `${siteUrl}/about`, lastModified: generatedAt, changeFrequency: "monthly", priority: 0.6 },
    { url: `${siteUrl}/contact`, lastModified: generatedAt, changeFrequency: "monthly", priority: 0.6 },
    { url: `${siteUrl}/privacy-policy`, lastModified: generatedAt, changeFrequency: "monthly", priority: 0.4 },
    { url: `${siteUrl}/terms-and-conditions`, lastModified: generatedAt, changeFrequency: "monthly", priority: 0.4 },
    { url: `${siteUrl}/cookies-policy`, lastModified: generatedAt, changeFrequency: "monthly", priority: 0.4 }
  ];

  const categoryPages = activeCategories.map((category) => ({
    url: `${siteUrl}/category/${category}`,
    lastModified: generatedAt,
    changeFrequency: "daily",
    priority: 0.7
  }));

  const articlePages = posts
    .filter((post) => post?.slug)
    .map((post) => ({
      url: `${siteUrl}/news/${post.slug}`,
      lastModified: post.updatedAt || post.sitePublishedAt || post.publishedAt || generatedAt,
      changeFrequency: "weekly",
      priority: 0.8
    }));

  const urls = [...staticPages, ...categoryPages, ...articlePages];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map(renderUrl)
    .join("\n")}\n</urlset>`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
      "X-Robots-Tag": "index, follow"
    }
  });
}
