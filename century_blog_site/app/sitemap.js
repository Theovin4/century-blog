import { getPosts } from "@/lib/posts-store";
import { getSiteUrl } from "@/lib/site";

export default async function sitemap() {
  const siteUrl = getSiteUrl();
  const posts = await getPosts();

  return [
    {
      url: siteUrl,
      lastModified: new Date()
    },
    {
      url: `${siteUrl}/about`,
      lastModified: new Date()
    },
    {
      url: `${siteUrl}/contact`,
      lastModified: new Date()
    },
    {
      url: `${siteUrl}/privacy-policy`,
      lastModified: new Date()
    },
    ...posts.map((post) => ({
      url: `${siteUrl}/news/${post.slug}`,
      lastModified: new Date(post.updatedAt || post.publishedAt)
    }))
  ];
}
