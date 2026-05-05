import Link from "next/link";
import { getPosts } from "@/lib/posts-store";
import { formatLongDate } from "@/lib/site";

export const metadata = {
  title: "Blog | Century Blog",
  description: "Browse the latest stories, analysis, and updates published on Century Blog."
};

export default async function BlogPage() {
  const posts = await getPosts();

  return (
    <main className="page-shell">
      <section className="section-card" style={{ maxWidth: "960px", margin: "0 auto" }}>
        <div className="section-header">
          <div>
            <span className="eyebrow">Blog</span>
            <h1>Latest stories from Century Blog</h1>
          </div>
          <p>
            Explore recent news, features, and practical stories published across Nigeria, world, business, tech,
            entertainment, health, lifestyle, education, and daily gist.
          </p>
        </div>

        <div style={{ display: "grid", gap: "1rem" }}>
          {posts.map((post) => (
            <article key={post.id} className="dashboard-post-card">
              <div className="dashboard-post-card__content">
                <p className="dashboard-post-card__meta">
                  {post.category} | {formatLongDate(post.updatedAt || post.publishedAt)}
                </p>
                <h2 style={{ marginBottom: "0.5rem" }}>
                  <Link href={`/news/${post.slug}`}>{post.title}</Link>
                </h2>
                <p>{post.excerpt}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
