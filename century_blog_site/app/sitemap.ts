import type { MetadataRoute } from "next";
import { getPosts } from "@/lib/posts-store";
import { getActiveCategories } from "@/lib/site";

const siteUrl = "https://centuryblogg.vercel.app";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const posts = await getPosts();
  const activeCategories = getActiveCategories(posts);

  return [
    {
      url: siteUrl,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1
    },
    {
      url: `${siteUrl}/blog`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8
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
      changeFrequency: "daily" as const,
      priority: 0.8
    })),
    ...posts.map((post) => ({
      url: `${siteUrl}/news/${post.slug}`,
      lastModified: new Date(post.updatedAt || post.publishedAt || now),
      changeFrequency: "daily" as const,
      priority: 0.9
    }))
  ];
}
