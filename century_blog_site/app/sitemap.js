import { getPosts } from "@/lib/posts-store";
import { categoryOptions, getSiteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function sitemap() {
  const siteUrl = getSiteUrl();
  const posts = await getPosts();
  const now = new Date();

  return [
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
    ...categoryOptions.map((category) => ({
      url: `${siteUrl}/category/${category}`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8
    })),
    ...posts.map((post) => ({
      url: `${siteUrl}/news/${post.slug}`,
      lastModified: new Date(post.updatedAt || post.publishedAt),
      changeFrequency: "daily",
      priority: 0.9
    }))
  ];
}
